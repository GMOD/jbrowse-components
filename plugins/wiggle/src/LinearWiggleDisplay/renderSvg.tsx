/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { ScoreRuleLines } from '@jbrowse/wiggle-core'

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import {
  WiggleFamilySvgFrame,
  svgLegendRightPx,
  svgScalebarLeftPx,
} from '../shared/WiggleFamilySvg.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'
import WiggleSvgScale from './WiggleSvgScale.tsx'

import type { LinearWiggleDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type React from 'react'

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, WiggleSvgBody)
}

function WiggleSvgBody(props: LgvSvgBodyProps<LinearWiggleDisplayModel>) {
  const { model, view, canvasWidth } = props
  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="wiggle"
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        const gpuProps = model.gpuProps()
        drawWiggleToCtx(
          ctx,
          {
            rpcDataMap: model.rpcDataMap,
            encode: data => buildSourceRenderData(data, gpuProps),
          },
          renderBlocks,
          { ...model.renderState, canvasWidth: w, canvasHeight: drawHeight },
        )
      }}
      overlay={
        model.scoreRuleMarks.length > 0 ? (
          <ScoreRuleLines marks={model.scoreRuleMarks} width={canvasWidth} />
        ) : null
      }
      legend={
        <WiggleSvgScale
          model={model}
          scalebarLeft={svgScalebarLeftPx(view)}
          legendRight={svgLegendRightPx(view, canvasWidth)}
          ticks={model.ticks}
        />
      }
    />
  )
}
