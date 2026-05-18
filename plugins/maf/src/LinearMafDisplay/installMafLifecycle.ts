import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type {
  MafBackend,
  MafGPURenderState,
  MafRpcDataEntry,
} from '../LinearMafRenderer/mafBackendTypes.ts'
import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

interface MafLifecycleSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
  mafRenderState: MafGPURenderState | undefined
  renderBlocks: RenderBlock[]
  rpcDataMap: ObservableMap<number, MafRpcDataEntry>
}

/**
 * Per-region streamed upload for MAF. Each rpcDataMap key gets its own
 * autorun so a new region's arrival re-uploads only that region (O(1))
 * while a settings change re-fires every per-key autorun (O(N) re-encode).
 * See `agent-docs/ARCHITECTURE.md` "Per-region streamed: per-key autoruns".
 */
export function installMafLifecycle(
  self: MafLifecycleSelf,
  backend: MafBackend,
) {
  const perKeyDisposers = new Map<number, () => void>()
  addDisposer(self, () => {
    for (const dispose of perKeyDisposers.values()) {
      dispose()
    }
  })
  self.installGpuDisplay<MafBackend>(backend, {
    upload: b => {
      const active: number[] = []
      for (const key of self.rpcDataMap.keys()) {
        active.push(key)
        if (!perKeyDisposers.has(key)) {
          perKeyDisposers.set(
            key,
            autorun(() => {
              const data = self.rpcDataMap.get(key)
              const current = self.currentGpuBackend as MafBackend | undefined
              if (data !== undefined && current !== undefined) {
                current.uploadRegion(
                  key,
                  data.instanceBuffer,
                  data.instanceCount,
                  data.regionData,
                )
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
      const state = self.mafRenderState
      if (!state) {
        return false
      }
      b.renderBlocks(self.renderBlocks, state)
      return true
    },
  })
}
