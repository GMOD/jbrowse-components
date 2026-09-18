import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'
import { ATTRIBUTE_PREFIX, attributeColorBy } from '@jbrowse/synteny-core'

import type { RIBBON_COLOR_SCALES } from './ribbonColorConfigSchema.ts'
import type { AttributeColorBy, ValueColorBy } from '@jbrowse/synteny-core'

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

function isAttributeMode(mode: RibbonColorBy): mode is AttributeColorBy {
  return mode.startsWith(ATTRIBUTE_PREFIX)
}

/** The mode `ribbonColor` paints, in the synteny colour functions' terms. */
export function ribbonColorByOf(color: {
  scale: RibbonColorScale | undefined
  field: string
}): RibbonColorBy {
  const scale = paintedScale(color, 'categorical')
  return scale === 'categorical'
    ? attributeColorBy(color.field)
    : scale === 'none'
      ? 'default'
      : scale
}

/**
 * The `ribbonColor` object that paints `mode`, written over `current`: a
 * scheme keeps the column, its order and the constant for a switch back, and
 * a column keeps its order only when it is the one already named.
 */
export function ribbonColorFor(
  mode: RibbonColorBy,
  current: RibbonColorSnapshot,
): RibbonColorSnapshot {
  if (isAttributeMode(mode)) {
    const field = mode.slice(ATTRIBUTE_PREFIX.length)
    const { scale, domain, ...rest } = current
    return { ...rest, field, ...(field === current.field ? { domain } : {}) }
  }
  return { ...current, scale: mode === 'default' ? 'none' : mode }
}
