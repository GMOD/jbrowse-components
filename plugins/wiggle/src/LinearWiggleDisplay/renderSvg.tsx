import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import { renderWiggleFamilySvg } from '../shared/WiggleFamilySvg.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import WiggleSvgScale from './WiggleSvgScale.tsx'

import type { LinearWiggleDisplayModel } from './model.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderWiggleFamilySvg({
    model,
    opts,
    clipIdPrefix: 'wiggle',
    paint: (ctx, { canvasWidth, drawHeight, renderBlocks }) => {
      const props = model.gpuProps()
      const state = {
        ...model.renderState,
        canvasWidth,
        canvasHeight: drawHeight,
      }
      drawWiggleToCtx(
        ctx,
        {
          rpcDataMap: model.rpcDataMap,
          encode: data => buildSourceRenderData(data, props),
        },
        renderBlocks,
        state,
      )
    },
    legend: info => <WiggleSvgScale model={model} {...info} />,
  })
}
