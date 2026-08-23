import { createMapUploadSync } from './mapUploadSync.ts'

interface RegionUploadTarget<T> {
  uploadRegion(displayedRegionIndex: number, data: T): void
  pruneRegions(active: Iterable<number>): void
}

/**
 * The per-region configuration of {@link createMapUploadSync}, which
 * `installPerRegionLifecycle` runs underneath an encode step (ADR-078) for
 * every per-region display there is. Departed regions are released through
 * the HAL's active-set `pruneRegions`.
 *
 * @see regionUploadSync.test.ts — covers the reference-diff skip, prune, and
 * backend-swap re-upload paths.
 */
export function createRegionUploadSync<T, B extends RegionUploadTarget<T>>() {
  return createMapUploadSync<number, T, B>({
    upload: (backend, key, data) => {
      backend.uploadRegion(key, data)
    },
    prune: (backend, active) => {
      backend.pruneRegions(active)
    },
  })
}
