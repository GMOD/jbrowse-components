import { createReadlineInterface, getLocalOrRemoteStream } from './common.ts'

import type { IndexerOptions } from '../util.ts'

// GFF3-style attribute names have no GTF equivalent, so the shared defaults
// (`Name`, `ID`, `symbol`) would index nothing. Each requested name also pulls
// in its GTF spellings, so `jbrowse text-index` works on a GTF out of the box
// while an explicit `--attributes gene_biotype` still works verbatim.
const gtfAttributeAliases: Record<string, string[]> = {
  Name: ['gene_name', 'transcript_name'],
  ID: ['gene_id', 'transcript_id'],
  symbol: ['gene_name'],
}

function expandAttributeNames(attributesToIndex: string[]) {
  return [
    ...new Set(
      attributesToIndex.flatMap(a => [a, ...(gtfAttributeAliases[a] ?? [])]),
    ),
  ]
}

/**
 * True when an entry opens a double quote it never closes, meaning the ';' it
 * was split on fell inside the value instead of ending the entry.
 */
function hasUnclosedQuote(entry: string) {
  const first = entry.indexOf('"')
  return first !== -1 && !entry.includes('"', first + 1)
}

/**
 * Parse the GTF 9th column (`gene_id "X"; transcript_id "Y";`), mirroring
 * plugins/gtf so the indexed text matches what the track displays: entries are
 * `key value` separated by a space (not `key=value`), values may be quoted, a
 * repeated key expresses multiple values, and a quoted value may contain the
 * ';' the entries are split on (`note "a; b"`), so its pieces are rejoined
 * before the value is read.
 */
export function parseGtfAttributes(attrString: string) {
  const attrs: Record<string, string[]> = {}
  const entries = attrString.split(';')
  for (let i = 0; i < entries.length; i++) {
    let entry = entries[i]!
    while (hasUnclosedQuote(entry) && i + 1 < entries.length) {
      entry += `;${entries[++i]}`
    }
    const trimmed = entry.trim()
    const sp = trimmed.indexOf(' ')
    if (sp !== -1) {
      const key = trimmed.slice(0, sp)
      const value = trimmed
        .slice(sp + 1)
        .trim()
        .replaceAll(/^"|"$/g, '')
        // a comma separates record ids in the trix .ix format, so it can never
        // survive into an indexed word
        .replaceAll(',', ' ')
      if (value) {
        ;(attrs[key] ??= []).push(value)
      }
    }
  }
  return attrs
}

// composite map keys join refName + id; a separator that cannot occur in
// either keeps two loci from colliding
const SEP = '\u0000'

interface Group {
  refName: string
  start: number
  end: number
  attrs: Set<string>
}

/**
 * GTF, unlike GFF3, has no gene or transcript rows: a gene exists only as the
 * exon/CDS/UTR rows repeating its `gene_id`. Indexing per row would point every
 * hit at a single exon, so rows are grouped by `gene_id` and `transcript_id`
 * and each group is emitted once spanning all of its rows.
 *
 * Grouping is what keeps one entry per gene rather than one per exon, so
 * `featureTypesToExclude` does not apply here — dropping rows would only
 * truncate the spans.
 *
 * The group map is held until EOF because GTF rows for one locus are not
 * guaranteed contiguous. It is keyed by gene/transcript id, so it stays far
 * smaller than the whole-file parse plugins/gtf already does to display a GTF.
 */
export async function* indexGtf({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  onStart,
  onUpdate,
  checkAbort,
}: IndexerOptions) {
  const { trackId } = config

  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onStart,
    onUpdate,
  })

  const rl = createReadlineInterface(stream, inLocation)
  const encodedTrackId = encodeURIComponent(trackId)
  const attributeNames = expandAttributeNames(attributesToIndex)
  const groups = new Map<string, Group>()

  function accumulate(
    key: string,
    refName: string,
    start: number,
    end: number,
    values: string[],
  ) {
    if (values.length > 0) {
      const group = groups.get(key)
      if (group) {
        group.start = Math.min(group.start, start)
        group.end = Math.max(group.end, end)
        for (const value of values) {
          group.attrs.add(value)
        }
      } else {
        groups.set(key, { refName, start, end, attrs: new Set(values) })
      }
    }
  }

  for await (const line of rl) {
    checkAbort?.()
    if (line.trim() && !line.startsWith('#')) {
      const [seq_id, , , start, end, , , , col9] = line.split('\t')

      if (
        seq_id !== undefined &&
        start !== undefined &&
        end !== undefined &&
        col9 !== undefined
      ) {
        const parsed = parseGtfAttributes(col9)
        const geneId = parsed.gene_id?.[0]
        const transcriptId = parsed.transcript_id?.[0]
        const s = Number(start)
        const e = Number(end)

        // `gene_*` names describe the gene, everything else the transcript, so
        // a gene entry is labeled by its gene_name rather than by whichever
        // transcript happened to come first
        const geneValues: string[] = []
        const otherValues: string[] = []
        for (const name of attributeNames) {
          for (const value of parsed[name] ?? []) {
            ;(name.startsWith('gene') ? geneValues : otherValues).push(value)
          }
        }

        if (transcriptId === undefined) {
          const values = [...geneValues, ...otherValues]
          // no id to group on: merge rows that carry identical values, which
          // still collapses the repeated rows of one feature into one entry
          const key = geneId ?? values.join(SEP)
          accumulate(`gene${SEP}${seq_id}${SEP}${key}`, seq_id, s, e, values)
        } else {
          accumulate(
            `tx${SEP}${seq_id}${SEP}${transcriptId}`,
            seq_id,
            s,
            e,
            otherValues,
          )
          if (geneId !== undefined) {
            accumulate(
              `gene${SEP}${seq_id}${SEP}${geneId}`,
              seq_id,
              s,
              e,
              geneValues,
            )
          }
        }
      }
    }
  }

  for (const { refName, start, end, attrs } of groups.values()) {
    const locStr = `${refName}:${start}..${end}`
    const encodedAttrs = [...attrs].map(a => `"${encodeURIComponent(a)}"`)
    const record = `["${encodeURIComponent(locStr)}"|"${encodedTrackId}"|${encodedAttrs.join('|')}]`

    yield `${record} ${[...attrs].join(' ')}\n`
  }
}
