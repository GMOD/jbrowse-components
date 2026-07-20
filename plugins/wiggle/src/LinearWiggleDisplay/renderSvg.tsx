import { YScaleBar } from '@jbrowse/wiggle-core'

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import { renderWiggleFamilySvg } from '../shared/WiggleFamilySvg.tsx'
import ScoreLegend from '../shared/ScoreLegend.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'

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
    // density mode draws a top score legend (color encodes score); otherwise the
    // left y-axis. Both appear only once a real domain / ticks exist.
    legend: ({ scalebarLeft, canvasWidth, ticks }) =>
      model.isDensityMode ? (
        model.domain ? (
          <ScoreLegend
            domain={model.domain}
            scaleType={model.scaleType}
            canvasWidth={canvasWidth}
          />
        ) : null
      ) : ticks ? (
        <g transform={`translate(${scalebarLeft})`}>
          <YScaleBar ticks={ticks} orientation="left" />
        </g>
      ) : null,
  })
}
