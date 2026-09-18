import { paintedScale } from '@jbrowse/display-kit/colorConfigSchema'

import { ATTRIBUTE_PREFIX, continuousRampConfig } from './colorRamps.ts'
import { attributeColorBy } from './colorUtils.ts'

import type {
  AttributeColorBy,
  MeasurementColorBy,
  SyntenyColorBy,
} from './colorUtils.ts'
import type {
  SYNTENY_VIEW_FIELDS,
  SyntenyColorSnapshot,
} from './syntenyColorConfigSchema.ts'

/** A field a surface reads as a mode of its own, `strand` on every surface. */
export type StructuralColorBy = (typeof SYNTENY_VIEW_FIELDS)[number]

/** A mode the Color by value submenu offers: a measurement, or a column. */
export type ValueColorBy = MeasurementColorBy | AttributeColorBy

/** The modes a surface reading the structural fields `S` paints. */
export type ColorByOver<S extends StructuralColorBy> =
  | 'default'
  | S
  | ValueColorBy

const PRESET_FIELDS: ReadonlyMap<string, MeasurementColorBy> = new Map(
  Object.entries(continuousRampConfig).map(
    ([mode, { attribute }]) => [attribute, mode as MeasurementColorBy] as const,
  ),
)

function isAttributeMode(mode: SyntenyColorBy): mode is AttributeColorBy {
  return mode.startsWith(ATTRIBUTE_PREFIX)
}

/**
 * #api
 * The mode a synteny colour object paints, in the colour functions' terms.
 * `reads` are the structural fields the surface has a reader for: a field
 * outside them and outside the measurement presets is a declared column.
 */
export function syntenyColorByOf<S extends StructuralColorBy>(
  { scale, field = '' }: SyntenyColorSnapshot,
  reads: readonly S[],
): ColorByOver<S> {
  if (paintedScale({ scale, field }, 'categorical') === 'none') {
    return 'default'
  }
  return (
    reads.find(f => f === field) ??
    PRESET_FIELDS.get(field) ??
    attributeColorBy(field)
  )
}

/** The `field` a mode reads: a preset's attribute, or the column it names. */
export function syntenyColorField(mode: Exclude<SyntenyColorBy, 'default'>) {
  return isAttributeMode(mode)
    ? mode.slice(ATTRIBUTE_PREFIX.length)
    : mode in continuousRampConfig
      ? continuousRampConfig[mode as MeasurementColorBy].attribute
      : mode
}

/**
 * #api
 * The colour object that paints `mode`, written over `current`: the default
 * keeps the field and its order under `scale: 'none'` for a switch back, and
 * a field keeps its order only when it is the one already named.
 */
export function syntenyColorFor(
  mode: SyntenyColorBy,
  current: SyntenyColorSnapshot,
): SyntenyColorSnapshot {
  if (mode === 'default') {
    return { ...current, scale: 'none' }
  }
  const field = syntenyColorField(mode)
  const { scale, domain, ...rest } = current
  return { ...rest, field, ...(field === current.field ? { domain } : {}) }
}
