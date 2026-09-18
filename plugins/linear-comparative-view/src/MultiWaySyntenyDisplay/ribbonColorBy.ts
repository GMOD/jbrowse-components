import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'
import {
  ATTRIBUTE_PREFIX,
  attributeColorBy,
  continuousRampConfig,
} from '@jbrowse/synteny-core'

import type { RIBBON_COLOR_SCALES } from './ribbonColorConfigSchema.ts'
import type {
  AttributeColorBy,
  MeasurementColorBy,
  ValueColorBy,
} from '@jbrowse/synteny-core'

type RibbonColorScale = (typeof RIBBON_COLOR_SCALES)[number]

/** The modes a ribbon paints, as the synteny Color by menu offers them. */
export type RibbonColorBy = 'default' | 'strand' | ValueColorBy

/** The `ribbonColor` object as its config snapshot holds it. */
export interface RibbonColorSnapshot {
  value?: string
  field?: string
  scale?: RibbonColorScale
  domain?: readonly string[]
}

/**
 * The fields with a vocabulary or ramp of their own, keyed by the attribute
 * the synteny colour functions read: `strand`, and each measurement preset.
 */
const PRESET_FIELDS: ReadonlyMap<string, 'strand' | MeasurementColorBy> =
  new Map<string, 'strand' | MeasurementColorBy>([
    ['strand', 'strand'],
    ...Object.entries(continuousRampConfig).map(
      ([mode, { attribute }]) =>
        [attribute, mode as MeasurementColorBy] as const,
    ),
  ])

function isAttributeMode(mode: RibbonColorBy): mode is AttributeColorBy {
  return mode.startsWith(ATTRIBUTE_PREFIX)
}

/** The mode `ribbonColor` paints, in the synteny colour functions' terms. */
export function ribbonColorByOf(color: {
  scale: RibbonColorScale | undefined
  field: string
}): RibbonColorBy {
  return paintedScale(color, 'categorical') === 'none'
    ? 'default'
    : (PRESET_FIELDS.get(color.field) ?? attributeColorBy(color.field))
}

/** The `field` a mode reads: a preset's attribute, or the column it names. */
export function ribbonColorField(mode: Exclude<RibbonColorBy, 'default'>) {
  return isAttributeMode(mode)
    ? mode.slice(ATTRIBUTE_PREFIX.length)
    : mode === 'strand'
      ? 'strand'
      : continuousRampConfig[mode].attribute
}

/**
 * The `ribbonColor` object that paints `mode`, written over `current`: the
 * default keeps the field and its order under `scale: 'none'` for a switch
 * back, and a field keeps its order only when it is the one already named.
 */
export function ribbonColorFor(
  mode: RibbonColorBy,
  current: RibbonColorSnapshot,
): RibbonColorSnapshot {
  if (mode === 'default') {
    return { ...current, scale: 'none' }
  }
  const field = ribbonColorField(mode)
  const { scale, domain, ...rest } = current
  return { ...rest, field, ...(field === current.field ? { domain } : {}) }
}
