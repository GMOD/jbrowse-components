import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { InstallGpuDisplayCallbacks } from './GpuBackendLifecycleSlotMixin.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

interface PerRegionGpuLifecycleSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
}

interface UploadableBackend<Encoded> {
  uploadRegion(displayedRegionIndex: number, encoded: Encoded): void
  pruneRegions(active: number[]): void
}

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
 * `render` is forwarded as-is to `installGpuDisplay`; it owns the per-frame
 * draw call and returns whether anything was actually drawn (gates the
 * `canvasDrawn` flag — see InstallGpuDisplayCallbacks).
 */
export function installPerRegionGpuLifecycle<
  Data,
  Encoded,
  B extends UploadableBackend<Encoded>,
>(
  self: PerRegionGpuLifecycleSelf,
  rpcDataMap: ObservableMap<number, Data>,
  backend: B,
  encode: (data: Data) => Encoded | undefined,
  render: InstallGpuDisplayCallbacks<B>['render'],
) {
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })

  self.installGpuDisplay<B>(backend, {
    upload: b => {
      const active: number[] = []
      for (const key of rpcDataMap.keys()) {
        active.push(key)
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              const data = rpcDataMap.get(key)
              const bCurrent = self.currentGpuBackend as B | undefined
              if (data !== undefined && bCurrent !== undefined) {
                const encoded = encode(data)
                if (encoded !== undefined) {
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
        }
      }
      b.pruneRegions(active)
    },
    render,
  })
}
