// Back-compat for SharedGCContentModel: the explicit override fields were
// renamed from the bare `windowSize`/`windowDelta`/`gcMode` to their `*Override`
// names. The matching getters now take the bare names.
export function migrateGCContentSnapshot(
  snap: Record<string, unknown> | undefined,
) {
  if (snap) {
    const { windowSize, windowDelta, gcMode, ...rest } = snap
    return {
      ...rest,
      windowSizeOverride: rest.windowSizeOverride ?? windowSize,
      windowDeltaOverride: rest.windowDeltaOverride ?? windowDelta,
      gcModeOverride: rest.gcModeOverride ?? gcMode,
    }
  }
  return snap
}
