import { getFrame, measureText } from '@jbrowse/core/util'
import { featureBedColor } from '@jbrowse/core/util/colorBits'

import { LITERAL, STROKE, cdsFrameClass } from './colorClasses.ts'
import { FEATURE_DEFAULT_COLOR, UTR_DEFAULT_COLOR } from './featureColors.ts'
import { readConfigValueSafe } from './renderConfig.ts'

import type { DisplayConfig } from './renderConfig.ts'
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

export function truncateLabel(text: string) {
  return text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : text
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

/**
 * A color the worker resolved, or the theme class the main thread has to
 * resolve for it. `color` is undefined exactly when `colorClass` is not
 * `LITERAL` — there is no literal to fall back to, because the worker has no
 * palette to read one from.
 */
export interface ClassedColor {
  color: string | undefined
  colorClass: number
}

export function getBoxColor({
  feature,
  config,
  colorByCDS,
  jexl,
}: {
  feature: Feature
  config: DisplayConfig
  colorByCDS: boolean
  jexl: JexlInstance
}): ClassedColor {
  // An unset (`maybeColor` undefined) slot means nothing asked for a color here,
  // so the file's own gets to speak; any set value wins, making "the config
  // beats the file" the single rule. Because unset is `undefined` rather than a
  // concrete default, every real color — goldenrod included — stays expressible.
  // utrColor deferring too is what reproduces UCSC's whole-item coloring, where
  // a thin block is thinner but not a different color; setting utrColor restores
  // the contrasting-UTR look.
  //
  // A UTR falls through to `color` when `utrColor` is unset, and this is what
  // makes the rule above hold for a whole transcript rather than for its coding
  // part. `color` describes the FEATURE; read as coding-only it broke its own
  // rule in the worst direction — with `color: 'red'` on a BED12 track, the
  // exon took red and the UTR of the same transcript took the file's itemRgb,
  // so the config beat the file at one end of a gene and lost to it at the
  // other. With no itemRgb it was worse-looking rather than incoherent: a red
  // gene with fixed teal ends. The visible cost was that a per-feature color had
  // to be authored TWICE — the hosted DTU demo carries the same 300-character
  // jexl in `color` and in `utrColor`, and the copy in the docs had already
  // drifted from the copy in the figure (18a40ce025).
  // Only a UTR that has a `utrColor` of its own reads that slot; every other box
  // reads `color`. When both are unset this still lands on the UTR default,
  // because the fallback below keys off the box and not off the slot it read.
  const isUtrBox = isUTR(feature)
  const slot = isUtrBox && config.utrColor !== undefined ? 'utrColor' : 'color'

  let fill =
    config[slot] === undefined
      ? (inheritedBedColor(feature) ??
        BOX_COLOR_SLOTS[isUtrBox ? 'utrColor' : 'color'])
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
    const frameClass = cdsFrameClass(frame)
    // An unrecognized frame keeps the resolved fill, which is what the missing
    // `palette.framesCDS.at(frame)` entry used to do.
    if (frameClass !== LITERAL) {
      return { color: undefined, colorClass: frameClass }
    }
  }

  return { color: fill, colorClass: LITERAL }
}

export function getStrokeColor({
  feature,
  config,
  jexl,
}: {
  feature: Feature
  config: DisplayConfig
  jexl: JexlInstance
}): ClassedColor {
  // The themed stroke is `palette.text.secondary`, which is translucent; keeping
  // its alpha is what lets connector lines and strand arrows blend into the
  // track as a subtle grey rather than glaring full-white (dark mode) or
  // full-black (light mode) at forced opacity. An unset slot takes it, and so
  // does a throwing jexl — degrading to the subtle line rather than crashing
  // the render, which is what the `undefined` fallback below expresses now that
  // the worker holds no palette to name the color with.
  const configured =
    config.connectorColor === undefined
      ? undefined
      : readConfigValueSafe<string | undefined>(
          config,
          'connectorColor',
          feature,
          jexl,
          undefined,
        )
  return configured === undefined
    ? { color: undefined, colorClass: STROKE }
    : { color: configured, colorClass: LITERAL }
}
