export interface InstanceCacheOpts<TData> {
  /**
   * A field of `data` whose object identity changes exactly when the geometry
   * does. Any one of the coordinate arrays works, because a refetch replaces
   * them atomically — but it must be a coordinate array, not a color one.
   */
  geomToken: (data: TData) => object
  /** The per-instance packed colors, whose identity a recolor replaces. */
  colors: (data: TData) => Uint32Array
  /** Pack every lane. Called only when the geometry moved. */
  interleave: (data: TData) => ArrayBuffer
  /** Instance stride and color-lane offset, in u32 words. */
  strideWords: number
  colorOffsetWords: number
}

/**
 * A per-key cache of packed instance bytes with a geometry/color split: a
 * recolor patches the one color lane in place instead of re-packing every
 * other one.
 *
 * The split is worth having because the two inputs move on completely
 * different schedules — geometry on an RPC refetch, colors on a `colorBy`
 * toggle or a palette change, which is interactive. Synteny re-packs 12 lanes
 * and dotplot 5; both had measured the patch as the difference between a
 * toggle that feels instant and one that doesn't.
 *
 * Shared because both had written it, identically, down to a sync comment on
 * the patch loop saying the color write must mirror the interleave. What
 * makes it worth a helper rather than two copies is the invalidation: get the
 * `geomToken` comparison or the `colors` write-back wrong and the failure is
 * stale geometry on screen, which no test catches and which looks like a data
 * problem. `installUpload` exists for the same reason one
 * layer up — an upload memo is not a hand-rolled `let`.
 *
 * The GPU re-upload still happens on a recolor (no HAL does partial buffer
 * updates); what is skipped is the dominant CPU interleave.
 */
export function createInstanceCache<TData>(opts: InstanceCacheOpts<TData>) {
  const { geomToken, colors, interleave, strideWords, colorOffsetWords } = opts
  const cache = new Map<
    number,
    { geom: object; colors: Uint32Array; buf: ArrayBuffer }
  >()
  return {
    /** Packed bytes for `key`, re-packing or re-coloring only as needed. */
    get(key: number, data: TData) {
      const geom = geomToken(data)
      const cols = colors(data)
      const hit = cache.get(key)
      if (hit?.geom === geom) {
        if (hit.colors !== cols) {
          const u32 = new Uint32Array(hit.buf)
          for (let i = 0, n = cols.length; i < n; i++) {
            u32[i * strideWords + colorOffsetWords] = cols[i]!
          }
          hit.colors = cols
        }
        return hit.buf
      }
      const buf = interleave(data)
      cache.set(key, { geom, colors: cols, buf })
      return buf
    },
    delete(key: number) {
      cache.delete(key)
    },
    clear() {
      cache.clear()
    },
  }
}
