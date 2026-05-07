/**
 * Remove entries from a region map whose keys are not in the active set.
 *
 * Calls `onRemove` for each pruned key BEFORE deleting from the map, so
 * callers can delete related resources (e.g. hal buffers, secondary maps)
 * in the same order the hand-rolled implementations used.
 */
export function pruneRegionMap<T>(
  regionMap: Map<number, T>,
  activeDisplayedRegionIndices: number[],
  onRemove?: (displayedRegionIndex: number) => void,
) {
  const active = new Set(activeDisplayedRegionIndices)
  for (const displayedRegionIndex of regionMap.keys()) {
    if (!active.has(displayedRegionIndex)) {
      onRemove?.(displayedRegionIndex)
      regionMap.delete(displayedRegionIndex)
    }
  }
}
