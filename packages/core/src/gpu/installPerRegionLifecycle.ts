import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { BackendCallbacks } from './GpuLifecycleMixin.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

interface LifecycleHost extends IAnyStateTreeNode {
  attachBackend: <B>(b: B, cbs: BackendCallbacks<B>) => void
  renderNow: () => void
  currentBackend: unknown
}

interface UploadableBackend<Encoded> {
  uploadRegion(displayedRegionIndex: number, encoded: Encoded): void
  pruneRegions(active: number[]): void
}

/**
 * Render callback signature for per-region lifecycles. The second argument
 * is the latest encoded-output map kept by the helper — wiggle reads from
 * it because its renderer is stateless and needs the encoded form per
 * frame; plugins whose renderer reads `rpcDataMap` directly (manhattan,
 * MAF, variants) ignore the second argument. Return `true` if anything was
 * drawn (flips `canvasDrawn` — see GpuLifecycle).
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
 * actually drawn (gates the `canvasDrawn` flag — see BackendCallbacks).
 */
export function installPerRegionLifecycle<
  Data,
  Encoded,
  B extends UploadableBackend<Encoded>,
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

  self.attachBackend<B>(backend, {
    upload: b => {
      const active: number[] = []
      for (const key of rpcDataMap.keys()) {
        active.push(key)
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              // `data` may be undefined briefly during a delete race —
              // the outer autorun disposes this one on next tick.
              const data = rpcDataMap.get(key)
              const bCurrent = self.currentBackend as B | undefined
              if (data !== undefined && bCurrent !== undefined) {
                const encoded = encode(data)
                if (encoded !== undefined) {
                  encodedRegions.set(key, encoded)
                  bCurrent.uploadRegion(key, encoded)
                  self.renderNow()
                }
              }
            }),
          )
        }
      }
      const activeSet = new Set(active)
      for (const [key, dispose] of perKeyDisposers) {
        if (!activeSet.has(key)) {
          dispose()
          perKeyDisposers.delete(key)
          encodedRegions.delete(key)
        }
      }
      b.pruneRegions(active)
    },
    render: b => render(b, encodedRegions),
  })
}
