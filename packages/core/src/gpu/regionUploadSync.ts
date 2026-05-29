interface RegionUploadTarget<T> {
  uploadRegion(displayedRegionIndex: number, data: T): void
  pruneRegions(active: Iterable<number>): void
}

/**
 * Incremental whole-map GPU upload for displays whose per-region data is a
 * single MobX computed that re-clones the whole map on any change (canvas,
 * alignments). Per-key autoruns can't help those — reading the computed in a
 * per-key autorun still tracks the whole computed (see
 * `installPerRegionLifecycle` for the per-key case that *can*).
 *
 * The returned function diffs the current map against the last upload by
 * reference and:
 *
 *  - uploads only regions whose data reference changed,
 *  - prunes regions no longer present (and forgets them, so a later
 *    same-reference re-arrival still re-uploads),
 *  - re-uploads everything when the backend identity changes — a context-loss
 *    recovery hands a fresh backend with empty GPU buffers.
 *
 * For the skip to fire, the data map must keep **stable references** for
 * unchanged regions across recomputes (e.g. canvas's `createIncrementalLayout`
 * memoizes per ref-group). With an always-fresh map every region re-uploads,
 * which is correct but defeats the optimization.
 *
 * Hold one instance per backend lifecycle (call from `startRenderingBackend`); the
 * closure keeps the last-uploaded references.
 */
export function createRegionUploadSync<T, B extends RegionUploadTarget<T>>() {
  const uploaded = new Map<number, T>()
  let lastRenderingBackend: B | undefined

  return function syncRegions(backend: B, regions: ReadonlyMap<number, T>) {
    if (backend !== lastRenderingBackend) {
      uploaded.clear()
      lastRenderingBackend = backend
    }
    const active = new Set<number>()
    for (const [displayedRegionIndex, data] of regions) {
      active.add(displayedRegionIndex)
      if (uploaded.get(displayedRegionIndex) !== data) {
        backend.uploadRegion(displayedRegionIndex, data)
        uploaded.set(displayedRegionIndex, data)
      }
    }
    // Deleting during Map key iteration is well-defined in JS — visited keys
    // stay visited, and we only drop keys absent from `active`.
    for (const displayedRegionIndex of uploaded.keys()) {
      if (!active.has(displayedRegionIndex)) {
        uploaded.delete(displayedRegionIndex)
      }
    }
    backend.pruneRegions(active)
  }
}
