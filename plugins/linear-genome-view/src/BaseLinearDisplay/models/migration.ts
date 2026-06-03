// Back-compat for TrackHeightMixin: the explicit-height field was renamed from
// `heightPreConfig` to `heightOverride`, and older snapshots also stored a bare
// `height`. Both normalize to `heightOverride`. Composed into every
// TrackHeightMixin display, so it covers displays without their own migration.
export function migrateTrackHeightSnapshot(
  snap: Record<string, unknown> | undefined,
) {
  if (
    snap &&
    snap.heightOverride === undefined &&
    (snap.height !== undefined || snap.heightPreConfig !== undefined)
  ) {
    const { height, heightPreConfig, ...rest } = snap
    return { ...rest, heightOverride: height ?? heightPreConfig }
  }
  return snap
}
