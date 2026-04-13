/**
 * Call `upload` only for regions whose data reference has changed since the
 * last call. Updates `cache` in-place. Prunes stale cache entries for regions
 * that are no longer in `dataMap`. Returns the list of active region numbers
 * for callers that need to pass it to `renderer.pruneRegions()`.
 *
 * All hook-driven GPU displays (wiggle, multi-wiggle, variants, alignments,
 * HiC, LD) should use this instead of re-uploading every region on every map
 * reference change. The model replaces the map reference on every
 * `setRpcData()` call (shallow copy), so the outer `lastDataMap !== dataMap`
 * guard fires even when only one region changed — this utility ensures only
 * that region pays the upload cost.
 */
export function uploadChangedRegions<T>(
  dataMap: Map<number, T>,
  cache: Map<number, T>,
  upload: (regionNumber: number, data: T) => void,
): number[] {
  const activeRegions: number[] = []
  for (const [regionNumber, data] of dataMap) {
    activeRegions.push(regionNumber)
    if (cache.get(regionNumber) !== data) {
      upload(regionNumber, data)
      cache.set(regionNumber, data)
    }
  }
  for (const key of cache.keys()) {
    if (!dataMap.has(key)) {
      cache.delete(key)
    }
  }
  return activeRegions
}
