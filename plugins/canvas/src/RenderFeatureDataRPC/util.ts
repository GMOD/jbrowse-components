import { getFrame, measureText } from '@jbrowse/core/util'
import { featureBedColor } from '@jbrowse/core/util/colorBits'

import { FEATURE_DEFAULT_COLOR, UTR_DEFAULT_COLOR } from './featureColors.ts'
import { readConfigValueSafe } from './renderConfig.ts'

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

// A BED's color rides on the top-level feature, but the gene glyph draws one
// box per subfeature (exon/CDS/UTR), which carry none — so look up the parent
// chain. Bare "255,0,0" is understood downstream by parseCssColor, so the value
// goes through as-is.
function inheritedBedColor(feature: Feature) {
  let cur: Feature | undefined = feature
  let found: string | undefined
  while (cur !== undefined && found === undefined) {
    found = featureBedColor(cur)
    cur = cur.parent?.()
  }
  return found
}

// The two fills a box can take, each with what its slot resolves to when unset
// and the feature declares no color of its own. UTRs get their own slot so a
// gene glyph can contrast them against the coding body.
const BOX_COLOR_SLOTS = {
  color: FEATURE_DEFAULT_COLOR,
  utrColor: UTR_DEFAULT_COLOR,
} as const

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
  // An unset (`maybeColor` undefined) slot means nothing asked for a color here,
  // so the file's own gets to speak; any set value wins, making "the config
  // beats the file" the single rule. Because unset is `undefined` rather than a
  // concrete default, every real color — goldenrod included — stays expressible.
  // utrColor deferring too is what reproduces UCSC's whole-item coloring, where
  // a thin block is thinner but not a different color; setting utrColor restores
  // the contrasting-UTR look.
  const slot = isUTR(feature) ? 'utrColor' : 'color'

  let fill =
    config[slot] === undefined
      ? (inheritedBedColor(feature) ?? BOX_COLOR_SLOTS[slot])
      : readConfigValueSafe<string>(config, slot, feature, jexl, INVALID_COLOR)

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
  // text.secondary is translucent; keep its alpha so connector lines and strand
  // arrows blend into the track as a subtle grey rather than glaring full-white
  // (dark mode) or full-black (light mode) at forced opacity. An unset slot
  // takes it, and so does a throwing jexl — degrading to the subtle line rather
  // than crashing the render.
  const themed = theme.palette.text.secondary
  return config.connectorColor === undefined
    ? themed
    : readConfigValueSafe<string>(
        config,
        'connectorColor',
        feature,
        jexl,
        themed,
      )
}
