import { mergeSpans } from '../../shared/mergeSpans.ts'
import { impliedUTRs } from '../impliedUTRs.ts'
import { getSubfeatures, isCDS, isExon, isUTR } from '../util.ts'

import type { Span } from '../../shared/mergeSpans.ts'
import type { TranscriptCoords } from '../rpcTypes.ts'
import type { FeatureLayout } from '../types.ts'

// Raw geometry only: the c./n. arithmetic lives on the main thread, which needs
// the same exon walk anyway to place the cursor.
//
// Reads the FEATURE, never `layout.children`: that list is what the glyph
// DRAWS, filtered by the display's `subParts` slot, so deriving coordinates
// from it would make an HGVS position a function of two rendering settings.
//
// Exons come back in TRANSCRIPTION order, so index/2 + 1 is the exon number a
// clinical report would use and a walk visits bases 5'→3'. Undefined unless the
// glyph is transcript-shaped: a match → match_part chain has blocks, not exons,
// and numbering them "exon 3/7" would be a lie.
//
// The coding extent is the outer min/max over the CDS rows rather than each
// segment: the exonic walk that turns this into a c. position skips introns, so
// the outer bounds place c.1 and c.*1 on their own. A file whose CDS rows omit
// the stop codon shifts every `*` position by three, which is the data's
// convention and not resolvable here.
export function transcriptCoords(
  layout: FeatureLayout,
): TranscriptCoords | undefined {
  const { feature, glyphType } = layout
  const exons: Span[] = []
  const codingOrUtr: Span[] = []
  let codeStart = Infinity
  let codeEnd = -Infinity
  const subs = getSubfeatures(feature)
  for (const sub of subs) {
    const span: Span = [sub.get('start'), sub.get('end')]
    if (isExon(sub)) {
      exons.push(span)
    } else if (isCDS(sub)) {
      codingOrUtr.push(span)
      codeStart = Math.min(codeStart, span[0])
      codeEnd = Math.max(codeEnd, span[1])
    } else if (isUTR(sub)) {
      codingOrUtr.push(span)
    }
  }
  const coding: Span | undefined =
    codeStart < codeEnd ? [codeStart, codeEnd] : undefined

  let spans = exons
  if (spans.length === 0) {
    if (glyphType !== 'ProcessedTranscript') {
      return undefined
    }
    spans = [
      ...codingOrUtr,
      ...impliedUTRs(feature, subs).map(u => [u.start, u.end] as Span),
    ]
  }
  const merged = mergeSpans(spans)
  if (merged.length === 0) {
    return undefined
  }
  if (feature.get('strand') === -1) {
    merged.reverse()
  }
  return { exons: merged.flat(), strand: feature.get('strand') ?? 1, coding }
}
