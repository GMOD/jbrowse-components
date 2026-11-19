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

/** The qualifiers as a GFF3 column 9, led by a `Name` for the track label */
function attributeString(
  qualifiers: Map<string, string[]>,
  extra: Record<string, string> = {},
) {
  const name = NAME_QUALIFIERS.map(q => qualifiers.get(q)?.[0]).find(Boolean)
  const entries = new Map<string, string[]>(name ? [['Name', [name]]] : [])
  for (const [key, value] of Object.entries(extra)) {
    entries.set(key, [value])
  }
  for (const [key, values] of qualifiers) {
    entries.set(key, values)
  }
  return [...entries]
    .map(([key, values]) => `${key}=${values.map(escapeValue).join(',')}`)
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

/** Each span's GFF3 phase, from `/codon_start` and the coding bases ahead */
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

/** One span is one feature; several are one feature with a child per span */
function folded(refName: string, placed: Placed) {
  const { entry, spans, attributes } = placed
  const pieces =
    entry.key === 'CDS'
      ? codingPieces(refName, placed)
      : spans.map(s => feature(refName, entry.key, s, attributes))
  const [only] = pieces
  return only && pieces.length === 1
    ? only
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

function shifted(placed: Placed, shift: number): Placed {
  return {
    ...placed,
    start: placed.start + shift,
    end: placed.end + shift,
    spans: placed.spans.map(s => ({
      ...s,
      start: s.start + shift,
      end: s.end + shift,
    })),
  }
}

function geneKeys(qualifiers: Map<string, string[]>) {
  return ['locus_tag', 'gene'].flatMap(name =>
    (qualifiers.get(name) ?? []).slice(0, 1).map(value => `${name}:${value}`),
  )
}

function overlaps(a: { start: number; end: number }, b: Placed) {
  return a.start < b.end && b.start < a.end
}

function byStart(a: Span, b: Span) {
  return a.start - b.start
}

function fitsExons(exons: Span[], cds: Span[]) {
  const pieces = cds.toSorted(byStart)
  const from = pieces[0]?.start ?? 0
  const to = pieces.at(-1)?.end ?? 0
  const spanned = exons
    .toSorted(byStart)
    .filter(e => e.start < to && from < e.end)
  return (
    spanned.length === pieces.length &&
    pieces.every((c, i) => {
      const exon = spanned[i]
      return (
        exon !== undefined &&
        exon.start <= c.start &&
        c.end <= exon.end &&
        (i === 0 || c.start === exon.start) &&
        (i === pieces.length - 1 || c.end === exon.end)
      )
    })
  )
}

/**
 * One record's features in the shapes the GFF3 adapter builds from NCBI's
 * GFF3 of the same record: genes over transcripts over exons and CDS rows.
 */
export function genbankFeatures(
  lines: string[],
  refName: string,
  length: number,
  circular: boolean,
) {
  const top: LazyGffFeature[] = []
  const genes = new Map<string, LazyGffFeature[]>()
  const transcripts = new Map<
    LazyGffFeature,
    { feature: LazyGffFeature; spans: Span[] }[]
  >()
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
        strand: spans.every(s => s.strand === -1) ? -1 : 1,
        attributes: attributeString(
          entry.qualifiers,
          isSource
            ? {
                gbkey: 'Src',
                ...(circular && start === 0 && end === length
                  ? { Is_circular: 'true' }
                  : {}),
              }
            : {},
        ),
      }
      const keys = geneKeys(entry.qualifiers)
      if (entry.key === 'gene') {
        const gene = feature(refName, 'gene', placed, placed.attributes)
        top.push(gene)
        for (const key of keys) {
          genes.set(key, [...(genes.get(key) ?? []), gene])
        }
      } else if (isSource) {
        top.push(feature(refName, 'region', placed, placed.attributes))
      } else {
        const shifts = circular ? [0, length, -length] : [0]
        const match = keys
          .flatMap(key => genes.get(key) ?? [])
          .flatMap(gene =>
            shifts.map(shift => ({ gene, child: shifted(placed, shift) })),
          )
          .find(({ gene, child }) => overlaps(gene, child))
        if (TRANSCRIPT_KEYS.has(entry.key)) {
          if (match) {
            const rna = transcript(refName, match.child)
            match.gene.subfeatures.push(rna)
            transcripts.set(match.gene, [
              ...(transcripts.get(match.gene) ?? []),
              { feature: rna, spans: match.child.spans },
            ])
          } else {
            top.push(transcript(refName, placed))
          }
        } else if (entry.key === 'CDS' && match) {
          const { gene, child } = match
          const fitting = (transcripts.get(gene) ?? []).filter(
            t => t.feature.type === 'mRNA' && fitsExons(t.spans, child.spans),
          )
          const parent =
            fitting.find(
              t => !t.feature.subfeatures.some(f => f.type === 'CDS'),
            )?.feature ??
            fitting[0]?.feature ??
            gene
          parent.subfeatures.push(...codingPieces(refName, child))
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
    uniqueId: `${refName}:${i}`,
  }))
}
