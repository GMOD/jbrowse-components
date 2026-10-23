/**
 * Drops a written `field: ''`, the beta spelling of "no field" on the
 * channels whose field is now a `maybeStringEnum`, where `''` would fail the
 * whole config load.
 *
 * @deprecated remove once no hosted config or saved session writes `''`
 */
export function dropEmptyField(snap: Record<string, unknown>) {
  if (snap.field !== '') {
    return snap
  }
  const { field: _field, ...rest } = snap
  return rest
}
