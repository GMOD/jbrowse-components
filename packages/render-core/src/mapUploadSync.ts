/**
 * What every backend that takes keyed uploads implements. One cell is one
 * immutable payload under one key, and the key is whatever the display's own
 * map is keyed by: a `displayedRegionIndex`, a sibling display's
 * `sharedBackendKey`, or a slot name on a display that holds one payload.
 *
 * `release` is per key, never an active-set prune. The diff below knows
 * exactly which keys departed, so a per-key release does the same job on a
 * display's own map and is the only correct shape on a canvas several displays
 * share, where a prune computed from one display's map would wipe its
 * siblings' buffers.
 */
export interface CellTarget<K, Encoded> {
  upload(key: K, data: Encoded): void
  release(key: K): void
}

/**
 * The one reference diff every keyed GPU upload in the tree runs on. Uploads
 * only entries whose data reference changed, releases entries no longer
 * present (and forgets them, so a later same-reference re-arrival still
 * re-uploads), and re-uploads everything when the backend identity changes —
 * a context-loss recovery hands a fresh backend with empty GPU buffers.
 *
 * Returns whether anything reached the backend, so the upload autorun can skip
 * the redraw it would otherwise force after every run.
 *
 * For the skip to fire, the map must keep **stable references** for unchanged
 * entries across recomputes. With an always-fresh map every entry re-uploads,
 * which is correct but defeats the optimization.
 *
 * **A display does not hold one of these.** `installUpload` owns it, built
 * inside the `attachRenderingBackend` setup thunk so the memo lives
 * exactly as long as the callbacks that read it.
 */
export function createMapUploadSync<
  K,
  T,
  B extends CellTarget<K, T> & object,
>() {
  const uploaded = new Map<K, T>()
  // weak: this outlives an unmounted backend, whose canvas and GL context a
  // strong ref would pin until the display remounts
  let lastRenderingBackend: WeakRef<B> | undefined

  return function sync(backend: B, entries: ReadonlyMap<K, T>) {
    if (backend !== lastRenderingBackend?.deref()) {
      uploaded.clear()
      lastRenderingBackend = new WeakRef(backend)
    }
    let changed = false
    for (const [key, data] of entries) {
      if (!uploaded.has(key) || uploaded.get(key) !== data) {
        backend.upload(key, data)
        uploaded.set(key, data)
        changed = true
      }
    }
    for (const key of uploaded.keys()) {
      if (!entries.has(key)) {
        backend.release(key)
        uploaded.delete(key)
        changed = true
      }
    }
    return changed
  }
}
