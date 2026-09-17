/**
 * The shorthand every value-or-scale sub-schema takes: `color: 'red'` and
 * `glyph: 'triangle'` are the bare-value form, while the object form binds a
 * field to a scale. One sub-schema holds both, so a string lifts into
 * `value`. An object naming a field and no scale reads it through the scale
 * its other slots imply, a `ramp` linear and anything else categorical, so a
 * field is never silently ignored. A `domain` written as numbers is carried
 * as strings, which is the one array slot type the schema has.
 */
export function liftValue(snap: unknown) {
  const obj: Record<string, unknown> =
    typeof snap === 'string' ? { value: snap } : { ...(snap as object) }
  if (Array.isArray(obj.domain)) {
    obj.domain = obj.domain.map(String)
  }
  if (typeof obj.field === 'string' && obj.field && obj.scale === undefined) {
    obj.scale = obj.ramp === undefined ? 'categorical' : 'linear'
  }
  return obj
}
