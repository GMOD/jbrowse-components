import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { getFrame } from '@jbrowse/core/util'
import { MISCONFIGURED_COLOR } from '@jbrowse/core/util/color'
import {
  cssColorToABGR as colorToUint32,
  featureBedColor,
} from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'

import { LITERAL, STROKE, cdsFrameClass } from '../colorClasses.ts'
import { getFeatureName } from '../labelUtils.ts'
import { readConfigValueSafe } from '../renderConfig.ts'
import { isCDS, isUTR } from '../util.ts'

import type { WorkerColor } from '../renderConfig.ts'
import type { ColorKey } from './colorKey.ts'
import type { RenderContext } from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export const TRANSL_EXCEPT_HIGHLIGHT = colorToUint32('#ffc850')

// Mature-protein regions take these by row order, so adjacent cleavage products
// stay visually separable.
export function matureProteinColor(index: number) {
  return categoricalPalette[index % categoricalPalette.length]!
}

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
  Tc1_Mariner_TIR_transposon: '#fabebe',
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

// A per-feature color expression that throws or answers nothing paints its
// box the misconfiguration grey, as the mark encoder paints one, rather than
// failing the whole track render.
const INVALID_COLOR = MISCONFIGURED_COLOR

// The gene glyph draws one box per subfeature, and a subfeature has no color
// of its own, so this reads the nearest ancestor that has one. That is not
// always the top-level feature: BigBedAdapter's `aggregateField` puts
// transcripts, each with its own color, under a synthesized gene with none.
function inheritedColor(
  feature: Feature,
  colorOf: (feature: Feature) => string | undefined,
) {
  let cur: Feature | undefined = feature
  let found: string | undefined
  while (cur !== undefined && found === undefined) {
    found = colorOf(cur)
    cur = cur.parent?.()
  }
  return found
}

function fieldColorReader(field: string, jexl: JexlInstance) {
  try {
    const read = fieldReader(field, jexl)
    return (feature: Feature) => {
      try {
        return valueText(read(feature)) || undefined
      } catch {
        return undefined
      }
    }
  } catch {
    return () => undefined
  }
}

/**
 * The color a box paints where no `value` does: the CSS color an identity
 * scale's field holds, as the mark display reads it, else the file's own BED
 * color, each off the nearest ancestor where the box carries none. Built once
 * per walk.
 */
export function ownColorReader(
  { identityField, itemRgbOn }: WorkerColor,
  jexl: JexlInstance,
): (feature: Feature) => string | undefined {
  const colorOf =
    identityField === undefined
      ? (cur: Feature) => featureBedColor(cur, itemRgbOn)
      : fieldColorReader(identityField, jexl)
  return feature => inheritedColor(feature, colorOf)
}

const BOX_COLOR_SLOTS = {
  color: featureDefaultColor,
  utrColor: utrDefaultColor,
} as const

/**
 * `color` is undefined exactly when `colorClass` is a theme class: the worker
 * holds no palette, so a themed color has no literal to fall back to.
 * `colorValue` is the box's index into the color field's values, one-based,
 * which the main thread paints in `color`'s place while the field paints.
 */
export interface ClassedColor {
  color: string | undefined
  colorClass: number
  colorValue?: number
}

/**
 * Unpacked, because `emitCodonRects` lightens the CSS string. `colorKey` is
 * the color field when the track names one: the box carries `level`'s value,
 * recorded only where no reading frame paints over it. `glyphDefault` is a
 * glyph's own palette, which paints only where the track sets no color, as a
 * BED's own colors do.
 */
export function boxColor(
  feature: Feature,
  ctx: RenderContext,
  colorKey?: ColorKey,
  level: Feature = feature,
  glyphDefault?: string,
): ClassedColor {
  const { config, colorByFrame, jexl } = ctx
  // An unset slot lets the file's own color speak and any set value beats it.
  // A UTR reads `utrColor` only when that slot is set, so `color` alone paints a
  // whole transcript rather than just its coding part; the fallback below keys
  // off the box, not the slot it read, so both unset still lands on the UTR
  // default.
  const isUtrBox = isUTR(feature)
  const slot = isUtrBox && config.utrColor !== undefined ? 'utrColor' : 'color'
  const raw = slot === 'color' ? config.color.value : config.utrColor
  const fill =
    raw === undefined
      ? ((ctx.ownColorOf ?? ownColorReader(config.color, jexl))(feature) ??
        glyphDefault ??
        BOX_COLOR_SLOTS[isUtrBox ? 'utrColor' : 'color'])
      : readConfigValueSafe<string>(
          config,
          slot === 'color' ? ['color', 'value'] : slot,
          feature,
          jexl,
          INVALID_COLOR,
        )

  const featureStrand = feature.get('strand')
  const featurePhase = feature.get('phase')

  if (
    colorByFrame &&
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

  const colorValue =
    slot === 'color' ? colorKey?.laneValueOf(feature, level) : undefined
  if (colorValue !== undefined) {
    colorKey?.record(colorValue)
  }
  return { color: fill, colorClass: LITERAL, colorValue }
}

/**
 * The intron lines, chevrons, strand arrows and repeat backbones: a themed
 * stroke has nothing to pack, so its color slot carries 0 and the main-thread
 * encode writes the lane from the class before anything draws.
 */
export const THEMED_STROKE: PackedColor = { color: 0, colorClass: STROKE }

export interface PackedColor {
  color: number
  colorClass: number
  colorValue?: number
}

export function packColor({
  color,
  colorClass,
  colorValue,
}: ClassedColor): PackedColor {
  return {
    color: color === undefined ? 0 : colorToUint32(color),
    colorClass,
    colorValue,
  }
}

/**
 * The hover text of each feature record, evaluated worker-side because the
 * full feature is here: through `fieldReader`, where a field that throws or
 * reads nothing degrades to the feature name rather than failing the render.
 * An empty field reads nothing. Resolved once per walk.
 */
export function tooltipReader(
  config: RenderContext['config'],
  jexl: RenderContext['jexl'],
): (feature: Feature) => string {
  const { tooltip } = config
  if (!tooltip) {
    return () => ''
  }
  const fallback = (feature: Feature) => getFeatureName(feature) ?? ''
  let read: (feature: Feature) => unknown
  try {
    read = fieldReader(tooltip, jexl)
  } catch {
    return fallback
  }
  return feature => {
    try {
      return valueText(read(feature)) || fallback(feature)
    } catch {
      return fallback(feature)
    }
  }
}

export function featureTooltip(feature: Feature, ctx: RenderContext) {
  return (ctx.tooltipOf ?? tooltipReader(ctx.config, ctx.jexl))(feature)
}
