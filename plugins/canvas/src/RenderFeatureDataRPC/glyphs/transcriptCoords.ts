import { mergeSpans } from '../../shared/mergeSpans.ts'
import { getSubfeatures, isCDS, isExon, isUTR } from '../util.ts'

import type { Span } from '../../shared/mergeSpans.ts'
import type { TranscriptCoords } from '../rpcTypes.ts'
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

function spanOf(feature: Feature): Span {
  return [feature.get('start'), feature.get('end')]
}

// Reads the FEATURE, never `layout.children`: that list is what the glyph DRAWS,
// filtered by the display's `subParts` slot, so deriving coordinates from it
// would make an HGVS position a function of two rendering settings.
//
// The overhang is capped per side, because annotations come with one UTR row and
// not the other. A side a row already reaches into is left alone — a spliced
// UTR's introns are unknowable from the bounds, and bridging them would count
// untranscribed bases into the numbering.
function reconstructedSpans(feature: Feature, coding: Span | undefined) {
  const spans = getSubfeatures(feature)
    .filter(f => isCDS(f) || isUTR(f))
    .map(spanOf)
  if (coding) {
    const [codeStart, codeEnd] = coding
    const start = feature.get('start')
    const end = feature.get('end')
    if (start < codeStart && !spans.some(([s]) => s < codeStart)) {
      spans.push([start, codeStart])
    }
    if (end > codeEnd && !spans.some(([, e]) => e > codeEnd)) {
      spans.push([codeEnd, end])
    }
  }
  return spans
}

// TRANSCRIPTION order, so index/2 + 1 is the exon number a clinical report would
// use and a walk visits bases 5'→3'. Undefined unless the glyph is
// transcript-shaped: a match → match_part chain has blocks, not exons, and
// numbering them "exon 3/7" would be a lie.
function exonSpans(layout: FeatureLayout, coding: Span | undefined) {
  const { feature, glyphType } = layout
  const exonChildren = getSubfeatures(feature).filter(isExon)
  const spans =
    exonChildren.length > 0
      ? exonChildren.map(spanOf)
      : glyphType === 'ProcessedTranscript'
        ? reconstructedSpans(feature, coding)
        : undefined

  if (!spans) {
    return undefined
  }
  const merged = mergeSpans(spans)
  if (merged.length === 0) {
    return undefined
  }
  if (feature.get('strand') === -1) {
    merged.reverse()
  }
  return merged
}

// Outer min/max over the CDS rows rather than each segment: the exonic walk that
// turns this into a c. position skips introns, so the outer bounds place c.1 and
// c.*1 on their own. A file whose CDS rows omit the stop codon shifts every `*`
// position by three, which is the data's convention and not resolvable here.
function codingBounds(feature: Feature): Span | undefined {
  const cds = getSubfeatures(feature).filter(isCDS)
  return cds.length > 0
    ? [
        Math.min(...cds.map(f => f.get('start'))),
        Math.max(...cds.map(f => f.get('end'))),
      ]
    : undefined
}

// Raw geometry only: the c./n. arithmetic lives on the main thread, which needs
// the same exon walk anyway to place the cursor.
export function transcriptCoords(
  layout: FeatureLayout,
): TranscriptCoords | undefined {
  const { feature } = layout
  // Resolved before the exons, which the CDS-only reconstruction measures its
  // untranslated overhang against.
  const coding = codingBounds(feature)
  const exons = exonSpans(layout, coding)
  return exons
    ? { exons: exons.flat(), strand: feature.get('strand') ?? 1, coding }
    : undefined
}
