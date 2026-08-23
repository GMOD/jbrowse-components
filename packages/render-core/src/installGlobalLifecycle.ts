import { createGlobalUploadSync } from './globalUploadSync.ts'

import type { LifecycleHost } from './RenderLifecycleMixin.ts'

/**
 * Upload one named slot, skipping it while its input is reference-identical to
 * what last went through it. Handed to {@link GlobalLifecycle.upload}, which is
 * the only place it is valid — it holds the memo for one backend lifecycle.
 */
export type UploadSlot<B> = <T>(
  key: string,
  value: T,
  upload: (backend: B, value: T) => void,
) => void

export interface GlobalLifecycle<B> {
  /**
   * Push whatever the display holds. **Read every input unconditionally**: a
   * read behind an `if` drops out of the autorun's dependency set on the runs
   * that skip it, the same hazard `installGlobalFetchAutorun` documents for its
   * trigger list. Let the slot's own callback handle the empty case.
   *
   * `slot` is for a display whose uploads have **independent** inputs — HiC's
   * contact matrix comes from the RPC and its palette from a config slot, so
   * without it a palette flip re-pushed the matrix. A display whose uploads all
   * derive from one field (LD, the variant matrix) can ignore it: the autorun's
   * whole dependency set is that field, so it cannot re-fire spuriously.
   */
  upload: (backend: B, slot: UploadSlot<B>) => void
  render: (backend: B) => boolean
}

/**
 * Upload lifecycle for a display with **no region map to diff** — one heatmap,
 * one contact matrix, one whole-view payload. The counterpart to
 * `installPerRegionLifecycle`, which diffs a keyed map, and
 * `installKeyedLifecycle`, which diffs one shared canvas's slots.
 *
 * `RenderLifecycleMixin` gives a display exactly one upload autorun, so every
 * observable any upload reads re-fires all of them. That is why `slot` exists,
 * and why it is scoped to this callback rather than being something the display
 * holds: its memo lives for one backend lifecycle, and a context-loss recovery
 * hands over empty GPU buffers, which drops it.
 *
 * @see globalUploadSync.test.ts for the per-slot diff,
 * installGlobalLifecycle.test.ts for the wiring.
 */
export function installGlobalLifecycle<B>(
  self: LifecycleHost,
  backend: B,
  { upload, render }: GlobalLifecycle<B>,
) {
  self.attachRenderingBackend<B>(backend, () => {
    const syncUpload = createGlobalUploadSync<B>()
    return {
      upload: b => {
        upload(b, (key, value, uploadOne) => {
          syncUpload(b, key, value, uploadOne)
        })
        return true
      },
      render,
    }
  })
}
