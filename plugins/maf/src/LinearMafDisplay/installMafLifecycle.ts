import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { buildInstanceBuffer } from '../LinearMafRenderer/mafInstanceBuffer.ts'

import type {
  MafBackend,
  MafGPURenderState,
  MafGpuProps,
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
  gpuProps: () => MafGpuProps | undefined
  renderBlocks: RenderBlock[]
  rpcDataMap: ObservableMap<number, MafRpcDataEntry>
}

/**
 * Per-region streamed upload for MAF. Each `rpcDataMap` key gets one
 * autorun that builds the GPU instance buffer on the main thread from the
 * raw region data plus `gpuProps()`. When `rpcDataMap[key]` updates only
 * that key's autorun re-encodes; when `gpuProps()` changes (theme,
 * showAllLetters, mismatchRendering) every per-key autorun re-encodes —
 * still no RPC traffic, just ~1ms of CPU per region.
 *
 * Encoding on the main thread (rather than baking in the worker) lets us
 * merge runs by *resolved color*, keeping the quad count proportional to
 * color transitions rather than to bases. See
 * `agent-docs/ARCHITECTURE.md` "Per-region streamed: per-key autoruns" and
 * ADR-016 for the gpuProps pattern.
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
              const props = self.gpuProps()
              const current = self.currentGpuBackend as MafBackend | undefined
              if (data !== undefined && props !== undefined && current !== undefined) {
                const { buffer, count } = buildInstanceBuffer({
                  blocks: data.regionData.blocks,
                  ...props,
                })
                current.uploadRegion(key, {
                  instanceBuffer: buffer,
                  instanceCount: count,
                  regionData: data.regionData,
                })
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
