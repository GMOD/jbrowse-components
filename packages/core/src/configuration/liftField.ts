/**
 * The shorthand every field-plus-order sub-schema takes: `y: 'score'` and
 * `facet: 'population'` are the bare-field form, while the object form spells
 * the scale or the section order out. One sub-schema holds both, so a string
 * lifts into `field`. A `domain` written as numbers is carried as strings,
 * which is the one array slot type the schema has.
 */
export function liftField(snap: unknown) {
  const obj: Record<string, unknown> =
    typeof snap === 'string' ? { field: snap } : { ...(snap as object) }
  if (Array.isArray(obj.domain)) {
    obj.domain = obj.domain.map(String)
  }
  return obj
}
