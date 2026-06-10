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
  // Apply a legacy field value only when the renamed key is not already set.
  const applyLegacy = (newKey: string, legacyVal: unknown) => {
    if (rest[newKey] === undefined && legacyVal !== undefined) {
      rest[newKey] = legacyVal
    }
  }
  applyLegacy('windowSizeOverride', windowSize)
  applyLegacy('windowDeltaOverride', windowDelta)
  applyLegacy('gcModeOverride', gcMode)
  return rest
}
