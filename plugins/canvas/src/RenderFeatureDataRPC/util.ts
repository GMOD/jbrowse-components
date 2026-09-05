import { measureText } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

export function truncateLabel(text: string) {
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : text
}

// The unit `truncateToWidth` cuts on. Not UTF-16 units, which split a surrogate
// pair into halves that draw as the replacement glyph, and not code points,
// which split a combining sequence or an emoji ZWJ join — either way one visible
// character becomes two. Built once: it is reached only by labels that overflow,
// but on a dense annotation that is most of them.
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Truncates text so its rendered width at fontSize never exceeds maxWidthPx,
// appending an ellipsis when shortened. Returns a string whose
// measureText(result, fontSize) is guaranteed <= maxWidthPx, so the caller's
// stored textWidth is bounded by construction and layout reservations match
// what is drawn. Single pass over the per-char widths; only over-budget strings
// enter the loop.
//
// A budget too small for the ellipsis itself yields nothing rather than a lone
// '…' — the one input that could return something wider than it was given, and
// the guarantee above is what the reservation is built on.
export function truncateToWidth(
  text: string,
  maxWidthPx: number,
  fontSize: number,
) {
  if (measureText(text, fontSize) <= maxWidthPx) {
    return text
  }
  const budget = maxWidthPx - measureText('…', fontSize)
  if (budget < 0) {
    return ''
  }
  const chars = [...GRAPHEMES.segment(text)].map(g => g.segment)
  let width = 0
  let kept = 0
  while (kept < chars.length) {
    const next = width + measureText(chars[kept]!, fontSize)
    if (next > budget) {
      break
    }
    width = next
    kept++
  }
  return `${chars.slice(0, kept).join('')}…`
}

// True when the value is a string with at least one non-whitespace character.
// Accepts undefined (treated as no text) and narrows to `string`, so callers can
// use it directly as a guard. A bare `/\S/.test(undefined)` would coerce to the
// string "undefined" and wrongly report visible text, so nullish is handled here.
export function hasVisibleText(text: string | undefined): text is string {
  return text !== undefined && /\S/.test(text)
}

// Feature type as a plain string, never undefined — the single place the
// optional `type` slot is defaulted. Pairs with isCDS/isExon/isUTR below.
export function featureType(feature: Feature) {
  return feature.get('type') ?? ''
}

// Direct children as a plain array, never undefined — the single place the
// optional `subfeatures` slot is resolved.
export function getSubfeatures(feature: Feature): Feature[] {
  return feature.get('subfeatures') ?? []
}

export function isUTR(feature: Feature) {
  return UTR_REGEX.test(featureType(feature))
}

// Case-insensitive: GFF3 mandates uppercase `CDS`, but lowercase `cds` shows up
// in real-world files. Centralizing avoids the dispatch path matching one case
// and the layout path matching another.
export function isCDS(feature: Feature) {
  return featureType(feature).toLowerCase() === 'cds'
}

// Case-insensitive for the same reason as isCDS: a function that finds CDS
// bounds case-insensitively but matches exons case-sensitively would derive
// UTRs from only some exons.
export function isExon(feature: Feature) {
  return featureType(feature).toLowerCase() === 'exon'
}
