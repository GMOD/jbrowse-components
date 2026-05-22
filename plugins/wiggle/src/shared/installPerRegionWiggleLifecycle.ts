import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '@jbrowse/wiggle-core'
import type { ObservableMap } from 'mobx'

interface PerRegionWiggleSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
  renderState: WiggleGPURenderState | undefined
  renderBlocks: WiggleRenderBlock[]
}

/**
 * Wiggle per-region lifecycle. Per-key autoruns encode sources, push to the
 * GPU, and cache the encoded form in a closure-local map. The render callback
 * passes that map to `renderBlocks` so the renderer stays stateless. The
 * cache is closure-local rather than MST volatile because writing to MST from
 * an autorun would force a separate action transaction per upload — the
 * encoded form is purely a render-pipeline detail, not display state.
 */
export function installPerRegionWiggleLifecycle<Data>(
  self: PerRegionWiggleSelf,
  rpcDataMap: ObservableMap<number, Data>,
  backend: WiggleBackend,
  encode: (data: Data) => SourceRenderData[],
) {
  const encodedRegions = new Map<number, SourceRenderData[]>()
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
                const encoded = encode(data)
                encodedRegions.set(key, encoded)
                bCurrent.uploadRegion(key, encoded)
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
          encodedRegions.delete(key)
        }
      }
      b.pruneRegions(active)
    },
    render: b => {
      const state = self.renderState
      if (!state) {
        return false
      }
      b.renderBlocks(self.renderBlocks, encodedRegions, state)
      return true
    },
  })
}
