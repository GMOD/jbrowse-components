import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { RenderingBackendCallbacks } from './RenderLifecycleMixin.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

export interface LifecycleHost extends IAnyStateTreeNode {
  attachRenderingBackend: <B>(b: B, cbs: RenderingBackendCallbacks<B>) => void
  renderNow: () => void
  setRenderError: (error: unknown) => void
  currentRenderingBackend: unknown
}

interface UploadableRenderingBackend<Encoded> {
  uploadRegion(displayedRegionIndex: number, encoded: Encoded): void
  pruneRegions(active: Iterable<number>): void
}

/**
 * Render callback signature for per-region lifecycles. The second argument
 * is the latest encoded-output map kept by the helper — wiggle reads from
 * it because its renderer is stateless and needs the encoded form per
 * frame; plugins whose renderer reads `rpcDataMap` directly (manhattan,
 * MAF, variants) ignore the second argument. Return `true` if anything was
 * drawn (flips `canvasDrawn` — see RenderLifecycle).
 */
export type PerRegionRender<B, Encoded> = (
  backend: B,
  encoded: ReadonlyMap<number, Encoded>,
) => boolean

/**
 * Per-region streamed upload for any GPU display whose data is keyed by
 * displayedRegionIndex. Each `rpcDataMap` key gets its own autorun, so a new
 * region's arrival re-uploads only that region (O(1)) while an encoding-input
 * change re-fires every per-key autorun (O(N) re-encode).
 *
 * `encode` runs inside the per-key autorun, so any observable it reads (e.g.
 * a config-derived view) is auto-tracked. Returning `undefined` skips the
 * upload for this tick — the autorun stays subscribed and re-fires once the
 * missing input (e.g. a theme-derived encoder param) becomes available.
 *
 * Successful encode results are cached in an internal map and passed to
 * `render` so stateless renderers (wiggle) can draw from it without
 * re-encoding per frame. Renderers that read `rpcDataMap` directly can
 * ignore the second arg.
 *
 * `render` owns the per-frame draw call and returns whether anything was
 * actually drawn (gates the `canvasDrawn` flag — see RenderingBackendCallbacks).
 *
 * @see installPerRegionLifecycle.test.ts — pins the O(1)-per-new-key /
 * O(N)-per-setting-change autorun semantics this helper exists for.
 */
export function installPerRegionLifecycle<
  Data,
  Encoded,
  B extends UploadableRenderingBackend<Encoded>,
>(
  self: LifecycleHost,
  rpcDataMap: ObservableMap<number, Data>,
  backend: B,
  encode: (data: Data) => Encoded | undefined,
  render: PerRegionRender<B, Encoded>,
) {
  const encodedRegions = new Map<number, Encoded>()
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })

  self.attachRenderingBackend<B>(backend, {
    upload: b => {
      const activeKeys = new Set(rpcDataMap.keys())
      for (const key of activeKeys) {
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              // `data` may be undefined briefly during a delete race —
              // the outer autorun disposes this one on next tick.
              const data = rpcDataMap.get(key)
              const bCurrent = self.currentRenderingBackend as B | undefined
              if (data !== undefined && bCurrent !== undefined) {
                // A throw in `encode`/`uploadRegion` is routed to renderError
                // (same rationale as RenderLifecycleMixin's upload/render
                // autoruns): uncaught here it would strand the display on
                // 'loading' with no retry. renderError unmounts the canvas and
                // disposes the backend, so it can't loop.
                try {
                  const encoded = encode(data)
                  if (encoded !== undefined) {
                    encodedRegions.set(key, encoded)
                    bCurrent.uploadRegion(key, encoded)
                    self.renderNow()
                  }
                } catch (e) {
                  self.setRenderError(e)
                }
              }
            }),
          )
        }
      }
      for (const [key, dispose] of perKeyDisposers) {
        if (!activeKeys.has(key)) {
          dispose()
          perKeyDisposers.delete(key)
          encodedRegions.delete(key)
        }
      }
      b.pruneRegions(activeKeys)
    },
    render: b => render(b, encodedRegions),
  })
}
