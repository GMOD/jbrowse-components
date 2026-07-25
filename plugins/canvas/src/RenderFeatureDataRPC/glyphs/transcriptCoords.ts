import { getSubfeatures, isCDS, isExon } from '../util.ts'

import type { TranscriptCoords } from '../rpcTypes.ts'
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

type Span = [start: number, end: number]

// Merge touching/overlapping spans, ascending. `<=` not `<` so the CDS and UTR
// halves of one exon (which abut exactly) join instead of counting twice.
function mergeSpans(spans: Span[]): Span[] {
  const merged: Span[] = []
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

function spanOf(feature: Feature): Span {
  return [feature.get('start'), feature.get('end')]
}

// A transcript's exons in TRANSCRIPTION order, so index/2 + 1 is the exon number
// a clinical report would use ("exon 5 of 12") and a walk over the list visits
// bases 5'→3'. On the - strand the highest-coordinate exon is exon 1, so the
// list is reversed.
//
// Prefers the transcript's own `exon` children. When a GFF carries only CDS/UTR
// rows — which is also all the default `subParts` renders — the coding and
// untranslated pieces of a single exon abut, so merging touching spans
// reconstructs the same exons. A transcript with neither exon rows nor UTR rows
// resolves its CODING exons, which is the most that data supports.
//
// Undefined unless the glyph is transcript-shaped: a match → match_part chain
// has blocks, not exons, and numbering them "exon 3/7" would be a lie.
function exonSpans(layout: FeatureLayout) {
  const { feature, glyphType } = layout
  const exonChildren = getSubfeatures(feature).filter(isExon)
  const spans =
    exonChildren.length > 0
      ? exonChildren.map(spanOf)
      : glyphType === 'ProcessedTranscript'
        ? layout.children.map(child => spanOf(child.feature))
        : undefined

  let ordered: Span[] | undefined
  if (spans) {
    const merged = mergeSpans(spans)
    if (merged.length > 0) {
      if (feature.get('strand') === -1) {
        merged.reverse()
      }
      ordered = merged
    }
  }
  return ordered
}

// The coding extent, or undefined for a non-coding transcript (numbered `n.`).
// Outer min/max over the CDS rows rather than each segment: everything between
// is either a coding exon or an intron, and the exonic walk that turns this into
// a c. position skips introns, so the outer bounds are all that is needed to
// place c.1 and c.*1.
//
// GFF3 CDS rows conventionally include the stop codon, which is what puts c.*1
// immediately after it. A file that omits the stop shifts the `*` positions by
// three — that is the data's convention, not something resolvable here.
function codingBounds(feature: Feature): [number, number] | undefined {
  const cds = getSubfeatures(feature).filter(isCDS)
  return cds.length > 0
    ? [
        Math.min(...cds.map(f => f.get('start'))),
        Math.max(...cds.map(f => f.get('end'))),
      ]
    : undefined
}

// Everything the hover needs to name a genomic position in transcript
// coordinates. Raw geometry only — the c./n. arithmetic lives in one place on
// the main thread (hgvsPosition.ts), which needs the same exon walk anyway to
// place the cursor.
export function transcriptCoords(
  layout: FeatureLayout,
): TranscriptCoords | undefined {
  const exons = exonSpans(layout)
  return exons
    ? {
        exons: exons.flat(),
        strand: layout.feature.get('strand') ?? 1,
        coding: codingBounds(layout.feature),
      }
    : undefined
}
