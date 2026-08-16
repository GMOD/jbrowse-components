import { mergeSpans } from '../../shared/mergeSpans.ts'
import { getSubfeatures, isCDS, isExon, isUTR } from '../util.ts'

import type { Span } from '../../shared/mergeSpans.ts'
import type { TranscriptCoords } from '../rpcTypes.ts'
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

function spanOf(feature: Feature): Span {
  return [feature.get('start'), feature.get('end')]
}

// The exonic pieces of a transcript that carries no `exon` rows, taken from the
// coding and untranslated rows it does carry: those abut within an exon, so
// merging touching spans reconstructs it.
//
// Read off the FEATURE, never off `layout.children`. That list is what the glyph
// DRAWS — `getSubparts` filters it to the display's `subParts` slot and
// synthesizes UTRs only when `impliedUTRs` is on — so deriving coordinates from
// it made an HGVS position a function of two rendering settings. Under the
// default slots the two agree, which is how it went unnoticed; `subParts: 'CDS'`
// alone silently drops every UTR position from a transcript annotated this way,
// and a `subParts` naming a non-exonic child type (an `intron` row) would count
// untranscribed bases into the c. numbering.
//
// Where no row covers the untranslated overhang, the transcript's own bounds
// are the only evidence of it, so they cap that side — the same reconstruction
// makeUTRs does for the renderer, and what keeps a CDS-only transcript
// reporting `c.-24` and `c.*17` rather than nothing.
//
// Per side, because annotations come with one UTR row and not the other. Asking
// "does this transcript have any UTR rows" instead threw away the overhang on
// BOTH sides the moment either was annotated, so a transcript with only a
// five_prime_UTR ended at its stop codon and read every `c.*n` position as off
// the transcript. A side a row already reaches into is left alone: a spliced
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

// A transcript's exons in TRANSCRIPTION order, so index/2 + 1 is the exon number
// a clinical report would use ("exon 5 of 12") and a walk over the list visits
// bases 5'→3'. On the - strand the highest-coordinate exon is exon 1, so the
// list is reversed.
//
// Prefers the transcript's own `exon` children, and falls back to the
// reconstruction above.
//
// Undefined unless the glyph is transcript-shaped: a match → match_part chain
// has blocks, not exons, and numbering them "exon 3/7" would be a lie.
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

// The coding extent, or undefined for a non-coding transcript (numbered `n.`).
// Outer min/max over the CDS rows rather than each segment: everything between
// is either a coding exon or an intron, and the exonic walk that turns this into
// a c. position skips introns, so the outer bounds are all that is needed to
// place c.1 and c.*1.
//
// GFF3 CDS rows conventionally include the stop codon, which is what puts c.*1
// immediately after it. A file that omits the stop shifts the `*` positions by
// three — that is the data's convention, not something resolvable here.
function codingBounds(feature: Feature): Span | undefined {
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
// the main thread (transcriptPosition.ts), which needs the same exon walk anyway to
// place the cursor.
export function transcriptCoords(
  layout: FeatureLayout,
): TranscriptCoords | undefined {
  const { feature } = layout
  // resolved before the exons, which the CDS-only reconstruction measures its
  // untranslated overhang against
  const coding = codingBounds(feature)
  const exons = exonSpans(layout, coding)
  return exons
    ? { exons: exons.flat(), strand: feature.get('strand') ?? 1, coding }
    : undefined
}
