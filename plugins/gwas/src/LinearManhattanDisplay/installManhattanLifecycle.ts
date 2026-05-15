import { installPerRegionGpuLifecycle } from '@jbrowse/core/gpu/installPerRegionGpuLifecycle'

import type {
  ManhattanBackend,
  ManhattanRegionData,
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../RenderManhattanDataRPC/rpcTypes.ts'
import type { InstallGpuDisplayCallbacks } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ObservableMap } from 'mobx'

interface PerRegionManhattanSelf extends IAnyStateTreeNode {
  installGpuDisplay: <B>(b: B, cbs: InstallGpuDisplayCallbacks<B>) => void
  renderNow: () => void
  currentGpuBackend: unknown
  renderBlocks: RenderBlock[]
  manhattanRenderState: ManhattanRenderState | undefined
}

export function installManhattanLifecycle(
  self: PerRegionManhattanSelf,
  rpcDataMap: ObservableMap<number, ManhattanRpcResult>,
  backend: ManhattanBackend,
  encode: (data: ManhattanRpcResult) => ManhattanRegionData,
) {
  installPerRegionGpuLifecycle(self, rpcDataMap, backend, encode, b => {
    const state = self.manhattanRenderState
    return state ? b.renderBlocks(self.renderBlocks, state) : false
  })
}
