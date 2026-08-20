interface KeyedUploadTarget<T> {
  uploadGeometry(key: number, data: T): void
  deleteGeometry(key: number): void
}

/**
 * Identity-diffed upload for a backend **shared by several displays**, each
 * owning one keyed geometry slot — the dotplot view's canvas and the synteny
 * level's canvas, both keyed by the display's {@link sharedBackendKey}.
 *
 * The counterpart to {@link createRegionUploadSync}, which diffs one display's
 * per-region map. The difference is the prune: this one deletes each departed
 * key individually rather than calling an active-set `pruneRegions`, because
 * the keys belong to sibling displays and an active-set prune computed from
 * one display's view of the map would wipe the others.
 *
 * `RenderLifecycleMixin` gives the backend owner exactly one upload autorun, so
 * any one display committing new geometry re-fires it for all of them. Without
 * the diff every sibling re-uploads its unchanged bytes on each commit.
 *
 * A backend swap (context-loss recovery hands back a fresh one with empty GPU
 * buffers) drops the memo, so the next run re-uploads every key.
 *
 * **A display does not hold one of these.** {@link installKeyedLifecycle} owns
 * it, built inside the `attachRenderingBackend` setup thunk so the memo lives
 * exactly as long as the callbacks that read it — which is what makes the
 * backend-swap clause above the only way it is ever dropped. A display declares
 * `entries` and `render` and never sees this function.
 *
 * @see keyedUploadSync.test.ts for the diff, installKeyedLifecycle.ts for the
 * only caller.
 */
export function createKeyedUploadSync<T, B extends KeyedUploadTarget<T>>() {
  const uploaded = new Map<number, T>()
  let lastRenderingBackend: B | undefined

  return function syncKeys(backend: B, entries: ReadonlyMap<number, T>) {
    if (backend !== lastRenderingBackend) {
      uploaded.clear()
      lastRenderingBackend = backend
    }
    for (const [key, data] of entries) {
      if (uploaded.get(key) !== data) {
        backend.uploadGeometry(key, data)
        uploaded.set(key, data)
      }
    }
    // Deleting during Map key iteration is well-defined in JS — visited keys
    // stay visited, and we only drop keys absent from `entries`.
    for (const key of uploaded.keys()) {
      if (!entries.has(key)) {
        backend.deleteGeometry(key)
        uploaded.delete(key)
      }
    }
  }
}
