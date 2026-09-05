import { getFrame } from '@jbrowse/core/util'
import {
  cssColorToABGR as colorToUint32,
  featureBedColor,
} from '@jbrowse/core/util/colorBits'

import { LITERAL, OUTLINE, STROKE, cdsFrameClass } from '../colorClasses.ts'
import { FEATURE_DEFAULT_COLOR, UTR_DEFAULT_COLOR } from '../featureColors.ts'
import { getFeatureName } from '../labelUtils.ts'
import { THEME_DERIVED_COLOR, readConfigValueSafe } from '../renderConfig.ts'
import { isCDS, isUTR } from '../util.ts'

import type { RenderContext } from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

export const TRANSL_EXCEPT_HIGHLIGHT = colorToUint32('#ffc850')

// Mature-protein regions take these by row order, so adjacent cleavage products
// stay visually separable.
export const MATURE_PROTEIN_COLOR_HEX = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
  '#aec7e8',
  '#ffbb78',
]
export const MATURE_PROTEIN_COLORS = MATURE_PROTEIN_COLOR_HEX.map(c =>
  colorToUint32(c),
)

// These two overpaint the feature's own box, which is their background, so a
// literal reads on either page theme.
export const CRISPR_PAM_COLOR = colorToUint32('#d32f2f')
export const CUT_SITE_COLOR = colorToUint32('#111111')

// Keyed by SO type rather than assigned by row, so the two LTRs of a
// transposon share a color and its TSDs share another.
const REPEAT_COLOR_MAP: Record<string, string> = {
  CACTA_TIR_transposon: '#e6194b',
  centromeric_repeat: '#3cb44b',
  Copia_LTR_retrotransposon: '#118119',
  Gypsy_LTR_retrotransposon: '#4363d8',
  hAT_TIR_transposon: '#f58231',
  helitron: '#911eb4',
  knob: '#46f0f0',
  L1_LINE_retrotransposon: '#f032e6',
  LINE_element: '#bcf60c',
  long_terminal_repeat: '#fb0',
  low_complexity: '#008080',
  LTR_retrotransposon: '#e6beff',
  Mutator_TIR_transposon: '#9a6324',
  PIF_Harbinger_TIR_transposon: '#fffac8',
  rDNA_intergenic_spacer_element: '#800000',
  repeat_region: '#aaffc3',
  RTE_LINE_retrotransposon: '#808000',
  subtelomere: '#ffd8b1',
  target_site_duplication: '#000075',
  Tc1_Mariner_TIR_transposon: '#808080',
}

const REPEAT_COLOR_BY_LOWER_TYPE = new Map(
  Object.entries(REPEAT_COLOR_MAP).map(([type, color]) => [
    type.toLowerCase(),
    color,
  ]),
)

export function repeatSubpartColor(type: string) {
  return REPEAT_COLOR_BY_LOWER_TYPE.get(type.toLowerCase())
}

export function isRetrotransposonBody(type: string) {
  return type.toLowerCase().endsWith('_retrotransposon')
}

// The internal body draws short so the full-height LTRs/TSDs painted over it
// still read as flanking caps.
export const REPEAT_BODY_HEIGHT_FRACTION = 0.65

// A throwing per-feature color expression degrades one box to magenta rather
// than failing the whole track render, and the bad slot stays visually obvious.
const INVALID_COLOR = 'magenta'

// A BED's color rides on the top-level feature, but the gene glyph draws one
// box per subfeature, which carry none — hence the walk up the parent chain.
function inheritedBedColor(feature: Feature) {
  let cur: Feature | undefined = feature
  let found: string | undefined
  while (cur !== undefined && found === undefined) {
    found = featureBedColor(cur)
    cur = cur.parent?.()
  }
  return found
}

const BOX_COLOR_SLOTS = {
  color: FEATURE_DEFAULT_COLOR,
  utrColor: UTR_DEFAULT_COLOR,
} as const

/**
 * `color` is undefined exactly when `colorClass` is not `LITERAL`: the worker
 * holds no palette, so a themed color has no literal to fall back to.
 */
export interface ClassedColor {
  color: string | undefined
  colorClass: number
}

/** Unpacked, because `emitCodonRects` lightens the CSS string. */
export function boxColor(feature: Feature, ctx: RenderContext): ClassedColor {
  const { config, colorByCDS, jexl } = ctx
  // An unset slot lets the file's own color speak and any set value beats it.
  // A UTR reads `utrColor` only when that slot is set, so `color` alone paints a
  // whole transcript rather than just its coding part; the fallback below keys
  // off the box, not the slot it read, so both unset still lands on the UTR
  // default.
  const isUtrBox = isUTR(feature)
  const slot = isUtrBox && config.utrColor !== undefined ? 'utrColor' : 'color'

  const fill =
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
    const frame = getFrame(
      feature.get('start'),
      feature.get('end'),
      featureStrand,
      featurePhase,
    )
    const frameClass = cdsFrameClass(frame)
    // An unrecognized frame keeps the resolved fill.
    if (frameClass !== LITERAL) {
      return { color: undefined, colorClass: frameClass }
    }
  }

  return { color: fill, colorClass: LITERAL }
}

/**
 * A themed stroke has nothing to pack, so its color slot carries 0 and the
 * main-thread encode overwrites the lane from the class before anything draws.
 */
export function strokeColor(feature: Feature, ctx: RenderContext): PackedColor {
  const { config, jexl } = ctx
  // A throwing jexl falls back to `undefined` alongside an unset slot, so both
  // degrade to the themed stroke rather than crashing the render.
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
  return packColor(
    configured === undefined
      ? { color: undefined, colorClass: STROKE }
      : { color: configured, colorClass: LITERAL },
  )
}

export interface PackedColor {
  color: number
  colorClass: number
}

export function packColor({ color, colorClass }: ClassedColor): PackedColor {
  return {
    color: color === undefined ? 0 : colorToUint32(color),
    colorClass,
  }
}

// Evaluated worker-side because the full feature is already here; a throwing
// override degrades to the feature name rather than failing the render.
export function featureTooltip(feature: Feature, ctx: RenderContext) {
  return String(
    readConfigValueSafe<unknown>(
      ctx.config,
      'mouseover',
      feature,
      ctx.jexl,
      getFeatureName(feature) ?? '',
    ),
  )
}

// The menu toggle stores THEME_DERIVED_COLOR rather than a literal, because a
// fixed black outline vanishes on a dark track.
export function resolveOutlineColor(outlineColor: string) {
  return outlineColor === THEME_DERIVED_COLOR
    ? { outlineColor: 0, outlineColorClass: OUTLINE }
    : {
        outlineColor: outlineColor ? colorToUint32(outlineColor) : 0,
        outlineColorClass: LITERAL,
      }
}
