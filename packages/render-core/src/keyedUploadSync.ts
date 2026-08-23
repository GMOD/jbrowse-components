import { createMapUploadSync } from './mapUploadSync.ts'

interface KeyedUploadTarget<T> {
  uploadGeometry(key: number, data: T): void
  deleteGeometry(key: number): void
}

/**
 * The shared-canvas configuration of {@link createMapUploadSync}: a backend
 * **shared by several displays**, each owning one keyed geometry slot — the
 * dotplot view's canvas and the synteny level's canvas, both keyed by the
 * display's {@link sharedBackendKey}. A departed key is deleted by itself,
 * never by an active-set prune, because the keys belong to sibling displays.
 *
 * `RenderLifecycleMixin` gives the backend owner exactly one upload autorun, so
 * any one display committing new geometry re-fires it for all of them; the
 * diff is what keeps the siblings' unchanged bytes off the bus.
 *
 * @see keyedUploadSync.test.ts for the diff, installKeyedLifecycle.ts for the
 * only caller.
 */
export function createKeyedUploadSync<T, B extends KeyedUploadTarget<T>>() {
  return createMapUploadSync<number, T, B>({
    upload: (backend, key, data) => {
      backend.uploadGeometry(key, data)
    },
    remove: (backend, key) => {
      backend.deleteGeometry(key)
    },
  })
}
