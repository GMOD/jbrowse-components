import { installUpload } from '@jbrowse/render-core/installUpload'

import { buildSourceRenderData } from './buildSourceRenderData.ts'

import type { WiggleGpuProps } from './buildSourceRenderData.ts'
import type { LifecycleHost } from '@jbrowse/render-core/RenderLifecycleMixin'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  WiggleDataResult,
  WiggleGPURenderState,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'

// The model surface installWiggleRenderingBackend needs. LinearWiggleDisplay and
// MultiLinearWiggleDisplay both satisfy it, so the identical per-region wiring
// lives here once instead of being copied into each model's
// startRenderingBackend.
interface WiggleLifecycleModel extends LifecycleHost {
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  gpuProps: () => WiggleGpuProps
  renderState: WiggleGPURenderState
  renderBlocks: RenderBlock[]
}

// Wire a wiggle-family display's per-region streamed upload/render lifecycle:
// encode each region via buildSourceRenderData(gpuProps) and draw the encoded
// map every frame. The backend answers whether anything painted, which keeps the
// loading overlay up until the first fetch lands.
export function installWiggleRenderingBackend(
  self: WiggleLifecycleModel,
  backend: WiggleRenderingBackend,
) {
  installUpload(self, backend, {
    cells: () => self.rpcDataMap,
    inputs: () => self.gpuProps(),
    encode: buildSourceRenderData,
    render: (b, encoded) =>
      b.renderBlocks(self.renderBlocks, encoded, self.renderState),
  })
}
