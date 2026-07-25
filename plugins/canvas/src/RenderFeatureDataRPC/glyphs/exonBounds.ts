import { getSubfeatures, isExon } from '../util.ts'

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

// A transcript's exons in TRANSCRIPTION order, flattened to
// [start0, end0, start1, end1, …] so index/2 + 1 is the exon number a clinical
// report would use ("exon 5 of 12"). On the - strand the highest-coordinate exon
// is exon 1, so the list is reversed.
//
// Prefers the transcript's own `exon` children. When a GFF carries only CDS/UTR
// rows — which is also all the default `subParts` renders — the coding and
// untranslated pieces of a single exon abut, so merging touching spans
// reconstructs the same exons. A transcript with neither exon rows nor UTR rows
// numbers its CODING exons, which is the most that data supports.
//
// Undefined unless the glyph is transcript-shaped: a match → match_part chain
// has blocks, not exons, and numbering them "exon 3/7" would be a lie. Also
// undefined for a single-exon transcript, where "exon 1/1" is noise.
export function transcriptExonBounds(layout: FeatureLayout) {
  const { feature, glyphType } = layout
  const exonChildren = getSubfeatures(feature).filter(isExon)
  const spans =
    exonChildren.length > 0
      ? exonChildren.map(spanOf)
      : glyphType === 'ProcessedTranscript'
        ? layout.children.map(child => spanOf(child.feature))
        : undefined

  let bounds: number[] | undefined
  if (spans) {
    const merged = mergeSpans(spans)
    if (merged.length > 1) {
      if (feature.get('strand') === -1) {
        merged.reverse()
      }
      bounds = merged.flat()
    }
  }
  return bounds
}
