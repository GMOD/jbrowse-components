interface RegionUploadTarget<T> {
  uploadRegion(displayedRegionIndex: number, data: T): void
  pruneRegions(active: Iterable<number>): void
}

/**
 * Incremental whole-map GPU upload, and **the one diff every per-region upload
 * in the tree runs on**: `installPerRegionLifecycle` calls it underneath an
 * encode step (ADR-078), for every per-region display there is.
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
 * **A display does not hold one of these.** {@link installPerRegionLifecycle}
 * owns it, built inside the `attachRenderingBackend` setup thunk so the closure
 * keeping the last-uploaded references lives exactly as long as the callbacks
 * that read it — which is what makes the backend swap above the only way it is
 * ever dropped.
 *
 * @see regionUploadSync.test.ts — covers the reference-diff skip, prune, and
 * backend-swap re-upload paths.
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
