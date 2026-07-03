import { getFrame, measureText } from '@jbrowse/core/util'

import {
  THEME_DERIVED_COLOR,
  readConfigValueSafe,
  resolveThemeColor,
} from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

// Fallback when a per-feature `color`/`utrColor` jexl expression throws (e.g. a
// callback referencing a missing plugin function or an attribute absent on some
// features). Magenta so the bad slot is visually obvious rather than silently
// wrong, matching parseCssColor's INVALID_COLOR contract — and, crucially, so
// one throwing feature degrades to a magenta box instead of failing the whole
// track render (the color slots are the last unguarded per-feature jexl reads;
// mouseover/labels already route through readConfigValueSafe).
const INVALID_COLOR = 'magenta'

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

// Truncates text so its rendered width at fontSize never exceeds maxWidthPx,
// appending an ellipsis when shortened. Returns a string whose
// measureText(result, fontSize) is guaranteed <= maxWidthPx, so the caller's
// stored textWidth is bounded by construction and layout reservations match
// what is drawn. Single pass over the per-char widths; only over-budget strings
// enter the loop.
export function truncateToWidth(
  text: string,
  maxWidthPx: number,
  fontSize: number,
) {
  if (measureText(text, fontSize) <= maxWidthPx) {
    return text
  }
  const budget = maxWidthPx - measureText('…', fontSize)
  let width = 0
  let i = 0
  while (i < text.length) {
    const next = width + measureText(text[i]!, fontSize)
    if (next > budget) {
      break
    }
    width = next
    i++
  }
  return `${text.slice(0, i)}…`
}

// True when the string contains at least one non-whitespace character.
export function hasVisibleText(text: string) {
  return /\S/.test(text)
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

export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
  jexl,
}: {
  feature: Feature
  config: DisplayConfig
  colorByCDS: boolean
  theme: Theme
  jexl: JexlInstance
}) {
  let fill = isUTR(feature)
    ? readConfigValueSafe<string>(
        config,
        'utrColor',
        feature,
        jexl,
        INVALID_COLOR,
      )
    : readConfigValueSafe<string>(config, 'color', feature, jexl, INVALID_COLOR)

  const featureStrand = feature.get('strand')
  const featurePhase = feature.get('phase')

  if (
    colorByCDS &&
    isCDS(feature) &&
    (featureStrand === 1 || featureStrand === -1) &&
    featurePhase !== undefined
  ) {
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const frame = getFrame(
      featureStart,
      featureEnd,
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }

  return fill
}

export function getStrokeColor({
  feature,
  config,
  theme,
  jexl,
}: {
  feature: Feature
  config: DisplayConfig
  theme: Theme
  jexl: JexlInstance
}) {
  // A throwing connectorColor jexl degrades to the theme-derived stroke (its
  // own default), keeping the line subtle rather than crashing the render.
  const c = readConfigValueSafe<string>(
    config,
    'connectorColor',
    feature,
    jexl,
    THEME_DERIVED_COLOR,
  )
  // text.secondary is translucent; keep its alpha so connector lines and strand
  // arrows blend into the track as a subtle grey rather than glaring full-white
  // (dark mode) or full-black (light mode) at forced opacity.
  return resolveThemeColor(c, theme.palette.text.secondary)
}
