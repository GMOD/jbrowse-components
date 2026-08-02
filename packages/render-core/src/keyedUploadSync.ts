interface KeyedUploadTarget<T> {
  uploadGeometry(key: number, data: T): void
  deleteGeometry(key: number): void
}

/**
 * Stable 32-bit slot for a display on a backend it shares with siblings, hashed
 * from its MST node id (djb2). Collisions are vanishingly rare at display
 * cardinalities, and the alternative — coordinating integer slots between
 * displays that don't know about each other — is worse.
 *
 * Key by this, never by the display's index in its parent's list. An index
 * renumbers when a sibling is hidden or reordered, which hands the survivor a
 * slot holding another display's bytes: {@link createKeyedUploadSync} sees a
 * changed reference and re-uploads every later display's whole buffer, and any
 * frame drawn between the two mistakes one display's geometry for another's.
 */
export function sharedBackendKey(id: string) {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  return h >>> 0
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
 * Hold one instance per backend lifecycle — create it in
 * `startRenderingBackend` *outside* the `attachRenderingBackend` call, since
 * the mixin captures the callbacks from the first call only:
 *
 * ```ts
 * startRenderingBackend(backend: DotplotRenderingBackend) {
 *   const syncUpload = createKeyedUploadSync<DotplotGeometryData, DotplotRenderingBackend>()
 *   self.attachRenderingBackend(backend, {
 *     upload: b => { syncUpload(b, self.geometryByDisplayKey) },
 *     render: …,
 *   })
 * }
 * ```
 *
 * @see keyedUploadSync.test.ts
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
