import { installPerRegionLifecycle } from '@jbrowse/render-core/installPerRegionLifecycle'

import { buildSourceRenderData } from './buildSourceRenderData.ts'

import type { WiggleDataResult } from '../util.ts'
import type { WiggleGpuProps } from './buildSourceRenderData.ts'
import type { LifecycleHost } from '@jbrowse/render-core/installPerRegionLifecycle'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  WiggleGPURenderState,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'
import type { ObservableMap } from 'mobx'

// The model surface installWiggleRenderingBackend needs. LinearWiggleDisplay and
// MultiLinearWiggleDisplay both satisfy it, so the identical per-region wiring
// lives here once instead of being copied into each model's
// startRenderingBackend.
interface WiggleLifecycleModel extends LifecycleHost {
  rpcDataMap: ObservableMap<number, WiggleDataResult>
  gpuProps: () => WiggleGpuProps
  renderState: WiggleGPURenderState
  renderBlocks: RenderBlock[]
}

// Wire a wiggle-family display's per-region streamed upload/render lifecycle:
// encode each region via buildSourceRenderData(gpuProps) and draw the encoded
// map every frame. `rpcDataMap.size === 0` keeps the loading overlay up until
// the first fetch lands; once loaded, renderState is always a real-or-stub
// state, so an empty region paints a cleared canvas (flipping canvasDrawn).
export function installWiggleRenderingBackend(
  self: WiggleLifecycleModel,
  backend: WiggleRenderingBackend,
) {
  installPerRegionLifecycle(
    self,
    self.rpcDataMap,
    backend,
    data => buildSourceRenderData(data, self.gpuProps()),
    (b, encoded) => {
      if (self.rpcDataMap.size === 0) {
        return false
      }
      b.renderBlocks(self.renderBlocks, encoded, self.renderState)
      return true
    },
  )
}
