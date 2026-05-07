import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'
import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

interface PerRegionWiggleSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
  renderState: WiggleGPURenderState | undefined
  renderBlocks: WiggleRenderBlock[]
}

/**
 * Per-region streamed upload for wiggle. Each rpcDataMap key gets its own
 * autorun, so a new region's arrival re-uploads only that region (O(1)) while
 * a gpuProps change re-fires every per-key autorun (O(N) re-encode). See
 * agent-docs/ARCHITECTURE.md "Per-region streamed: per-key autoruns".
 *
 * `encode` runs inside the per-key autorun, so any observable it reads (e.g.
 * `self.gpuProps()`) is auto-tracked.
 */
export function installPerRegionWiggleLifecycle<Data>(
  self: PerRegionWiggleSelf,
  rpcDataMap: ObservableMap<number, Data>,
  backend: WiggleBackend,
  encode: (data: Data) => SourceRenderData[],
) {
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })

  self.installGpuDisplay<WiggleBackend>(backend, {
    upload: b => {
      const active: number[] = []
      for (const key of rpcDataMap.keys()) {
        active.push(key)
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              const data = rpcDataMap.get(key)
              const bCurrent = self.currentGpuBackend as
                | WiggleBackend
                | undefined
              if (data !== undefined && bCurrent !== undefined) {
                bCurrent.uploadRegion(key, encode(data))
                self.renderNow()
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
    render: b => {
      const state = self.renderState
      if (!state) {
        return false
      }
      b.renderBlocks(self.renderBlocks, state)
      return true
    },
  })
}
