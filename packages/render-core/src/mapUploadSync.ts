export interface MapUploadTarget<K, T, B> {
  upload: (backend: B, key: K, data: T) => void
  remove?: (backend: B, key: K) => void
}

/**
 * The one reference diff every keyed GPU upload in the tree runs on. Uploads
 * only entries whose data reference changed, releases entries no longer
 * present (and forgets them, so a later same-reference re-arrival still
 * re-uploads), and re-uploads everything when the backend identity changes —
 * a context-loss recovery hands a fresh backend with empty GPU buffers.
 *
 * Returns whether anything reached the backend, which is what lets the upload
 * autorun skip the redraw it would otherwise force after every run.
 *
 * For the skip to fire, the map must keep **stable references** for unchanged
 * entries across recomputes. With an always-fresh map every entry re-uploads,
 * which is correct but defeats the optimization.
 *
 * **A display does not hold one of these.** The lifecycle installers own it,
 * built inside the `attachRenderingBackend` setup thunk so the memo lives
 * exactly as long as the callbacks that read it.
 */
export function createMapUploadSync<K, T, B>(target: MapUploadTarget<K, T, B>) {
  const uploaded = new Map<K, T>()
  let lastRenderingBackend: B | undefined

  return function sync(backend: B, entries: ReadonlyMap<K, T>) {
    if (backend !== lastRenderingBackend) {
      uploaded.clear()
      lastRenderingBackend = backend
    }
    let changed = false
    for (const [key, data] of entries) {
      if (!uploaded.has(key) || uploaded.get(key) !== data) {
        target.upload(backend, key, data)
        uploaded.set(key, data)
        changed = true
      }
    }
    for (const key of uploaded.keys()) {
      if (!entries.has(key)) {
        target.remove?.(backend, key)
        uploaded.delete(key)
        changed = true
      }
    }
    return changed
  }
}
