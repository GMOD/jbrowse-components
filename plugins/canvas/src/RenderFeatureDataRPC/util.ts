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
// pair, and not code points, which split a combining sequence or an emoji ZWJ
// join.
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// The result measures no wider than maxWidthPx, so a caller's stored textWidth
// is bounded by construction. A budget too small for the ellipsis itself yields
// nothing rather than a lone '…', the one input that could otherwise come back
// wider than it was given.
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

// A bare `/\S/.test(undefined)` coerces to the string "undefined" and wrongly
// reports visible text, so this handles nullish itself.
export function hasVisibleText(text: string | undefined): text is string {
  return text !== undefined && /\S/.test(text)
}

// The single place the optional `type` slot is defaulted.
export function featureType(feature: Feature) {
  return feature.get('type') ?? ''
}

// The single place the optional `subfeatures` slot is resolved.
export function getSubfeatures(feature: Feature): Feature[] {
  return feature.get('subfeatures') ?? []
}

export function isUTR(feature: Feature) {
  return UTR_REGEX.test(featureType(feature))
}

// Case-insensitive: GFF3 mandates uppercase `CDS`, but real-world files carry
// lowercase `cds`.
export function isCDS(feature: Feature) {
  return featureType(feature).toLowerCase() === 'cds'
}

// Case-insensitive like isCDS: matching exons case-sensitively would derive
// UTRs from only some exons.
export function isExon(feature: Feature) {
  return featureType(feature).toLowerCase() === 'exon'
}
