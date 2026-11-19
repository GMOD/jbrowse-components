import { parseFeatureTable } from './parseGenbank.ts'
import { parseLocation, placeSpans } from './parseLocation.ts'

import type { FeatureEntry } from './parseGenbank.ts'
import type { Span } from './parseLocation.ts'
import type { LazyGffFeature } from '@gmod/gff-nostream'

const TRANSCRIPT_KEYS = new Set([
  'mRNA',
  'tRNA',
  'rRNA',
  'ncRNA',
  'tmRNA',
  'misc_RNA',
  'precursor_RNA',
  'prim_transcript',
])

const NAME_QUALIFIERS = ['label', 'gene', 'locus_tag', 'product']

function escapeValue(value: string) {
  return value.replaceAll(
    /[%;=,&\t\n\r]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
  )
}

/**
 * A GFF3 column 9 holding the qualifiers as written, so the feature reads
 * through the same lazy attribute path a GFF3 feature does. `Name` is the
 * first of `/label` (SnapGene, Benchling), `/gene`, `/locus_tag` and
 * `/product`, the label a track draws.
 */
function attributeString(
  qualifiers: Map<string, string[]>,
  extra: [string, string][] = [],
) {
  const name = NAME_QUALIFIERS.map(q => qualifiers.get(q)?.[0]).find(Boolean)
  const entries: [string, string[]][] = [
    ...(name ? [['Name', [name]] as [string, string[]]] : []),
    ...extra.map(([k, v]): [string, string[]] => [k, [v]]),
    ...qualifiers,
  ]
  return entries
    .map(([k, values]) => `${k}=${values.map(escapeValue).join(',')}`)
    .join(';')
}

interface Placed {
  entry: FeatureEntry
  spans: Span[]
  start: number
  end: number
  strand: 1 | -1
  attributes: string
}

function feature(
  refName: string,
  type: string,
  { start, end, strand }: { start: number; end: number; strand: number },
  attributes: string,
  subfeatures: LazyGffFeature[] = [],
  phase?: number,
): LazyGffFeature {
  return {
    refName,
    source: null,
    type,
    start,
    end,
    strand,
    phase,
    attributeString: attributes,
    subfeatures,
  }
}

/**
 * Each span's GFF3 phase, the bases before its first whole codon, from the
 * `/codon_start` of the 5'-most span and the coding bases ahead of each.
 */
function spanPhases(spans: Span[], codonStart: number) {
  let before = 0
  return spans.map(s => {
    const phase = (((codonStart - 1 - before) % 3) + 3) % 3
    before += s.end - s.start
    return phase
  })
}

function codingPieces(refName: string, placed: Placed) {
  const phases = spanPhases(
    placed.spans,
    Number(placed.entry.qualifiers.get('codon_start')?.[0] ?? 1),
  )
  return placed.spans.map((s, i) =>
    feature(refName, 'CDS', s, placed.attributes, [], phases[i]),
  )
}

/**
 * A feature drawn on its own: one span is one feature, several are one
 * feature covering them with a child per span, the shape the GFF3 parser
 * folds a discontinuous feature into.
 */
function folded(refName: string, placed: Placed) {
  const { entry, spans, attributes } = placed
  const pieces =
    entry.key === 'CDS'
      ? codingPieces(refName, placed)
      : spans.map(s => feature(refName, entry.key, s, attributes))
  return spans.length === 1
    ? pieces[0]!
    : feature(refName, entry.key, placed, attributes, pieces)
}

function transcript(refName: string, placed: Placed) {
  return feature(
    refName,
    placed.entry.key,
    placed,
    placed.attributes,
    placed.spans.map(s => feature(refName, 'exon', s, '')),
  )
}

function overlaps(a: { start: number; end: number }, b: Placed) {
  return a.start < b.end && b.start < a.end
}

function contains(a: { start: number; end: number }, b: Placed) {
  return a.start <= b.start && b.end <= a.end
}

/**
 * One record's features in the shape the GFF3 adapter builds from NCBI's
 * GFF3 of the same record, in file order.
 *
 * - A `gene` is the parent of the transcripts and CDS sharing its
 *   `/locus_tag` (else `/gene`) and overlapping it; a CDS inside one of that
 *   gene's mRNAs hangs under the mRNA instead. A transcript's spans become
 *   `exon` children, a CDS's spans sibling `CDS` rows phased from
 *   `/codon_start`.
 * - A `source` becomes a `region` with `gbkey=Src`, as NCBI's GFF3 writes it,
 *   which the feature track admits but does not draw. The one covering a
 *   circular record also carries `Is_circular=true`.
 * - A feature crossing a circular record's origin is one feature past its
 *   length, which `cutAtOrigin` cuts.
 */
export function genbankFeatures(
  lines: string[],
  refName: string,
  length: number,
  circular: boolean,
) {
  const top: LazyGffFeature[] = []
  const genes = new Map<string, LazyGffFeature[]>()
  const transcripts = new Map<LazyGffFeature, LazyGffFeature[]>()
  for (const entry of parseFeatureTable(lines)) {
    const spans = placeSpans(
      parseLocation(entry.location, refName),
      length,
      circular &&
        !entry.location.includes('order(') &&
        !entry.qualifiers.has('trans_splicing'),
    )
    if (spans.length > 0) {
      const start = Math.min(...spans.map(s => s.start))
      const end = Math.max(...spans.map(s => s.end))
      const isSource = entry.key === 'source'
      const placed: Placed = {
        entry,
        spans,
        start,
        end,
        strand: spans[0]!.strand,
        attributes: attributeString(
          entry.qualifiers,
          isSource
            ? [
                ['gbkey', 'Src'],
                ...(circular && start === 0 && end === length
                  ? [['Is_circular', 'true'] as [string, string]]
                  : []),
              ]
            : [],
        ),
      }
      const key =
        entry.qualifiers.get('locus_tag')?.[0] ??
        entry.qualifiers.get('gene')?.[0]
      if (entry.key === 'gene') {
        const gene = feature(refName, 'gene', placed, placed.attributes)
        top.push(gene)
        if (key) {
          genes.set(key, [...(genes.get(key) ?? []), gene])
        }
      } else if (isSource) {
        top.push(feature(refName, 'region', placed, placed.attributes))
      } else {
        const gene = key
          ? genes.get(key)?.find(g => overlaps(g, placed))
          : undefined
        if (TRANSCRIPT_KEYS.has(entry.key)) {
          const rna = transcript(refName, placed)
          if (gene) {
            gene.subfeatures.push(rna)
            transcripts.set(gene, [...(transcripts.get(gene) ?? []), rna])
          } else {
            top.push(rna)
          }
        } else if (entry.key === 'CDS' && gene) {
          const parent =
            transcripts
              .get(gene)
              ?.find(t => t.type === 'mRNA' && contains(t, placed)) ?? gene
          parent.subfeatures.push(...codingPieces(refName, placed))
        } else {
          top.push(folded(refName, placed))
        }
      }
    }
  }
  return top.map((f, i) => ({
    start: f.start,
    end: f.end,
    feature: f,
    uniqueId: `${refName}-${i}`,
  }))
}
