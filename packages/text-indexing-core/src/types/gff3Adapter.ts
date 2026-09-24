import { decodeURIComponentNoThrow, trixLine } from '../util.ts'
import {
  createReadlineInterface,
  getLocalOrRemoteStream,
  parseAttributes,
} from './common.ts'

import type { Gff3IndexerOptions } from '../util.ts'

// GENCODE writes no `Name`: a gene row carries `gene_name`, a transcript row
// `transcript_name`, and every row repeats its parents' names too. So `Name`
// falls back to the name whose id is this row's own ID, which leaves a UTR or
// codon row unnamed rather than answering a search for its transcript.
function ownName(attrs: Record<string, string | undefined>) {
  const id = attrs.ID
  return id === undefined
    ? undefined
    : id === attrs.transcript_id
      ? attrs.transcript_name
      : id === attrs.gene_id
        ? attrs.gene_name
        : undefined
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

  for await (const line of rl) {
    checkAbort?.()
    if (!line.trim() || line.startsWith('#')) {
      continue
    } else if (line.startsWith('>')) {
      break
    }

    const [seq_id, , type, start, end, , , , col9] = line.split('\t')

    // a valid GFF3 feature row has 9 tab-delimited columns; skip malformed or
    // truncated lines that would otherwise make parseAttributes throw on an
    // undefined column 9 (mirrors the guard in the vcf indexer)
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
      const col9attrs = parseAttributes(col9, decodeURIComponentNoThrow)
      const attrs = attributesToIndex
        .map(
          attr =>
            col9attrs[attr] ??
            (attr === 'Name' ? ownName(col9attrs) : undefined),
        )
        .filter((f): f is string => !!f)

      if (attrs.length > 0) {
        yield trixLine(`${seq_id}:${start}..${end}`, trackId, attrs)
      }
    }
  }
}
