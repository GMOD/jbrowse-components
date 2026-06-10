// Back-compat for SharedGCContentModel:
//   - bare `windowSize`/`windowDelta`/`gcMode` renamed to `*Override`
//   - `blockState`/`showLegend`/`showTooltips` removed from BaseLinearDisplay
export function migrateGCContentSnapshot(
  snap: Record<string, unknown> | undefined,
) {
  if (!snap) {
    return snap
  }
  const {
    windowSize,
    windowDelta,
    gcMode,
    blockState: _blockState,
    showLegend: _showLegend,
    showTooltips: _showTooltips,
    ...rest
  } = snap
  if (rest.windowSizeOverride === undefined && windowSize !== undefined) {
    rest.windowSizeOverride = windowSize
  }
  if (rest.windowDeltaOverride === undefined && windowDelta !== undefined) {
    rest.windowDeltaOverride = windowDelta
  }
  if (rest.gcModeOverride === undefined && gcMode !== undefined) {
    rest.gcModeOverride = gcMode
  }
  return rest
}
