/**
 * The scales a colour object paints through, in a module that imports
 * nothing: `jbrowse validate` carries a copy of it, so the validator and the
 * displays read one statement.
 */

/** How a colour object maps its `field`; `none` paints `value`. */
export const COLOR_SCALES = [
  'none',
  'categorical',
  'linear',
  'log',
  'threshold',
] as const
export type ColorScaleName = (typeof COLOR_SCALES)[number]

/**
 * The scale a colour object paints through: `none` while no `field` is
 * named, else its own `scale`, or `fieldScale` where that is unset.
 */
export function paintedScale<S extends string, F extends string>(
  { scale, field }: { scale: S | undefined; field: string },
  fieldScale: F,
): S | F | 'none' {
  return field ? (scale ?? fieldScale) : 'none'
}
