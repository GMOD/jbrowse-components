/**
 * Identity-diffed upload slots for a **global** (non per-region) display — the
 * counterpart to {@link createRegionUploadSync}, which does the same job for a
 * per-region data map.
 *
 * `RenderLifecycleMixin` gives a display exactly one upload autorun, so every
 * observable any upload reads re-fires *all* of them. That is fine when a
 * display's uploads share one source (LD derives both its matrix and its color
 * ramp from `rpcData`), but a display whose slots have independent inputs pays
 * the cross product: HiC's palette is a config slot and its contact matrix comes
 * from the RPC, so without this a palette flip re-pushed the whole matrix and a
 * new fetch rebuilt the ramp texture.
 *
 * Each slot is keyed by name and skipped while its input is reference-identical
 * to what was last uploaded through it. A backend swap (context-loss recovery
 * hands back a fresh one with empty GPU buffers) drops every memo, so the next
 * run re-uploads all slots.
 *
 * **A display does not hold one of these.** {@link installGlobalLifecycle} owns
 * it, built inside the `attachRenderingBackend` setup thunk so the memo lives
 * exactly as long as the callbacks that read it — which is what makes the
 * backend-swap clause above the only way it is ever dropped. A display declares
 * `upload` and `render`, and reaches the slots through the `slot` argument that
 * installer hands it:
 *
 * ```ts
 * startRenderingBackend(backend: HicRenderingBackend) {
 *   installGlobalLifecycle<HicRenderingBackend>(self, backend, {
 *     upload: (b, slot) => {
 *       slot('data', self.rpcData, (bb, data) => {
 *         if (data) { bb.uploadData(data) }
 *       })
 *       slot('colorRamp', self.colorScheme, (bb, scheme) => {
 *         bb.uploadColorRamp(generateColorRamp(scheme))
 *       })
 *     },
 *     render: …,
 *   })
 * }
 * ```
 *
 * Read every slot's input unconditionally, exactly as above — a read placed
 * behind an `if` drops out of the autorun's dependency set on the runs that skip
 * it, the same hazard `installGlobalFetchAutorun` documents for its trigger
 * list. Let the `upload` callback handle the empty case instead.
 *
 * @see globalUploadSync.test.ts for the diff, installGlobalLifecycle.ts for the
 * only caller.
 */
export function createGlobalUploadSync<B>() {
  const uploaded = new Map<string, unknown>()
  let lastRenderingBackend: B | undefined

  return function syncUpload<T>(
    backend: B,
    key: string,
    value: T,
    upload: (backend: B, value: T) => void,
  ) {
    if (backend !== lastRenderingBackend) {
      uploaded.clear()
      lastRenderingBackend = backend
    }
    // `has` as well as the compare, so a slot whose input is legitimately
    // `undefined` uploads once instead of being mistaken for "never uploaded"
    // on every run.
    if (!uploaded.has(key) || uploaded.get(key) !== value) {
      upload(backend, value)
      uploaded.set(key, value)
    }
  }
}
