import { installPerRegionGpuLifecycle } from '@jbrowse/core/gpu/installPerRegionGpuLifecycle'

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

export function installPerRegionWiggleLifecycle<Data>(
  self: PerRegionWiggleSelf,
  rpcDataMap: ObservableMap<number, Data>,
  backend: WiggleBackend,
  encode: (data: Data) => SourceRenderData[],
) {
  installPerRegionGpuLifecycle(self, rpcDataMap, backend, encode, b => {
    const state = self.renderState
    if (state) {
      b.renderBlocks(self.renderBlocks, state)
      return true
    }
    return false
  })
}
