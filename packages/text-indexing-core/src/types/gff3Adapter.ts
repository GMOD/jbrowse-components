import { decodeURIComponentNoThrow, trixLine } from '../util.ts'
import { createReadlineInterface, getLocalOrRemoteStream } from './common.ts'

import type { Gff3IndexerOptions } from '../util.ts'

// Each attribute's values, a comma list split into its values (GFF3 escapes a
// literal comma as %2C, so a bare one always separates values)
function parseAttributeLists(col9: string) {
  const result: Record<string, string[]> = {}
  for (const field of col9.split(';')) {
    const eq = field.indexOf('=')
    if (eq !== -1) {
      const values = field
        .slice(eq + 1)
        .split(',')
        .map(v => decodeURIComponentNoThrow(v).trim())
        .filter(Boolean)
      if (values.length) {
        result[field.slice(0, eq).trim()] = values
      }
    }
  }
  return result
}

// GENCODE writes no `Name`: a gene row carries `gene_name`, a transcript row
// `transcript_name`, and every row repeats its parents' names too. So `Name`
// falls back to the name whose id is this row's own ID, which leaves a UTR or
// codon row unnamed rather than answering a search for its transcript.
function ownName(attrs: Record<string, string[]>) {
  const id = attrs.ID?.[0]
  return id === undefined
    ? undefined
    : id === attrs.transcript_id?.[0]
      ? attrs.transcript_name
      : id === attrs.gene_id?.[0]
        ? attrs.gene_name
        : undefined
}

interface IndexedFeature {
  id?: string
  parents: string[]
  loc: string
  values: { attr: string; value: string }[]
}

// a feature's own name and ID never move to its parent, however many children
// share them
const IDENTITY = new Set(['Name', 'ID'])

/**
 * The records for one run of features, each value indexed on the feature that
 * owns it. A value every child of a parent repeats (a gene's synonyms copied
 * onto each of its 368 transcripts, as tables converted to GFF3 often do)
 * moves to the parent, and a child stops repeating any value its parent
 * carries (GENCODE repeating the gene's name on each transcript). Otherwise a
 * search for one gene alias lists every transcript as a separate hit.
 */
function* ownedRecords(features: IndexedFeature[], trackId: string) {
  const byId = new Map<string, IndexedFeature>()
  const children = new Map<string, IndexedFeature[]>()
  for (const feature of features) {
    if (feature.id !== undefined) {
      byId.set(feature.id, feature)
    }
    for (const parent of feature.parents) {
      const list = children.get(parent)
      if (list) {
        list.push(feature)
      } else {
        children.set(parent, [feature])
      }
    }
  }
  for (const [parentId, kids] of children) {
    const parent = byId.get(parentId)
    if (parent) {
      const [first, ...rest] = kids
      const carried = new Set(parent.values.map(v => v.value))
      for (const v of first!.values) {
        if (
          !IDENTITY.has(v.attr) &&
          !carried.has(v.value) &&
          rest.every(kid =>
            kid.values.some(w => w.attr === v.attr && w.value === v.value),
          )
        ) {
          parent.values.push(v)
          carried.add(v.value)
        }
      }
    }
  }
  for (const feature of features) {
    const inherited = new Set(
      feature.parents.flatMap(p => byId.get(p)?.values.map(v => v.value) ?? []),
    )
    const values = feature.values
      .map(v => v.value)
      .filter(v => !inherited.has(v))
    if (values.length > 0) {
      yield trixLine(feature.loc, trackId, values)
    }
  }
}

/**
 * Stream one GFF3 into trix records, one line per indexed feature.
 *
 * Two type gates, and they answer different questions. `featureTypesToExclude`
 * names types this file is known to carry and nobody would search for — it is
 * the right shape when you own the vocabulary, which is why the default is
 * `exon,CDS`. `featureTypesToInclude` names the types worth indexing and drops
 * everything else, which is the only shape that stays correct against a
 * vocabulary someone else controls: an NCBI RefSeq GFF3 draws from 115 feature
 * types, 80 of which are leaf regulatory/repeat/alignment records carrying no
 * name (a `match` labels itself with a bare UUID, a `cDNA_match` with an MD5,
 * every `biological_region` with the literal string "biological region"), and a
 * deny list written against the types seen so far leaks the next one NCBI adds.
 * The allow list for that file is ~33 names — gene, pseudogene, and the
 * transcript-level types — and does not grow.
 *
 * Both apply when both are given: include admits, exclude then narrows.
 */
export async function* indexGff3({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  featureTypesToExclude,
  featureTypesToInclude,
  onStart,
  onUpdate,
  checkAbort,
}: Gff3IndexerOptions) {
  const { trackId } = config

  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onStart,
    onUpdate,
  })

  const rl = createReadlineInterface(stream, inLocation)
  const excludeSet = new Set(featureTypesToExclude)
  // Absent rather than empty, so an empty list means "no allow list" and not
  // "index nothing" — a caller that reads the list out of a config gets the
  // former when the slot is unset, and silently indexing zero features would
  // look exactly like a successful run.
  const includeSet = featureTypesToInclude?.length
    ? new Set(featureTypesToInclude)
    : undefined

  // held until the sequence changes or a `###` closes the run: a gene's
  // children sit on its sequence, so a sorted GFF3 never holds more than one
  // sequence's indexed features
  let run: IndexedFeature[] = []
  let runSeq: string | undefined
  for await (const line of rl) {
    checkAbort?.()
    if (line.startsWith('###') || line.startsWith('>')) {
      yield* ownedRecords(run, trackId)
      run = []
      if (line.startsWith('>')) {
        break
      }
      continue
    } else if (!line.trim() || line.startsWith('#')) {
      continue
    }

    const [seq_id, , type, start, end, , , , col9] = line.split('\t')

    // a valid GFF3 feature row has 9 tab-delimited columns; skip malformed or
    // truncated lines (mirrors the guard in the vcf indexer)
    if (
      seq_id === undefined ||
      type === undefined ||
      start === undefined ||
      end === undefined ||
      col9 === undefined
    ) {
      continue
    }

    if (
      !excludeSet.has(type) &&
      (includeSet === undefined || includeSet.has(type))
    ) {
      if (seq_id !== runSeq) {
        yield* ownedRecords(run, trackId)
        run = []
        runSeq = seq_id
      }
      const lists = parseAttributeLists(col9)
      run.push({
        id: lists.ID?.[0],
        parents: lists.Parent ?? [],
        loc: `${seq_id}:${start}..${end}`,
        values: attributesToIndex.flatMap(attr =>
          (
            lists[attr] ??
            (attr === 'Name' ? ownName(lists) : undefined) ??
            []
          ).map(value => ({ attr, value })),
        ),
      })
    }
  }
  yield* ownedRecords(run, trackId)
}
