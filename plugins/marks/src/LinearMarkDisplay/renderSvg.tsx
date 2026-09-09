/* eslint-disable react-refresh/only-export-components */
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import {
  WiggleFamilySvgFrame,
  svgLegendRightPx,
  svgScalebarLeftPx,
} from '@jbrowse/plugin-wiggle'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { YSCALEBAR_LABEL_OFFSET, YScaleBar } from '@jbrowse/wiggle-core'

import MarkLegend from './components/MarkLegend.tsx'

import type { MarkDisplayModel } from './components/markDisplayTypes.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type { WiggleFamilySvgModel } from '@jbrowse/plugin-wiggle'
import type React from 'react'

type RenderSvgModel = MarkDisplayModel & WiggleFamilySvgModel

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderDisplaySvg(model, opts, MarkSvgBody)
}

function MarkSvgBody(props: LgvSvgBodyProps<RenderSvgModel>) {
  const { model, view, height, canvasWidth } = props
  const legendRight = svgLegendRightPx(view, canvasWidth)
  return (
    <WiggleFamilySvgFrame
      {...props}
      clipIdPrefix="marks"
      paint={(ctx, { canvasWidth: w, drawHeight, renderBlocks }) => {
        paintMarkBlocks(ctx, model.markList, model.rpcDataMap, renderBlocks, {
          ...model.renderState,
          canvasWidth: w,
          canvasHeight: drawHeight,
        })
      }}
      legend={
        <>
          {model.ticks ? (
            <g transform={`translate(${svgScalebarLeftPx(view)})`}>
              <YScaleBar ticks={model.ticks} orientation="left" />
            </g>
          ) : null}
          {model.showLegend && model.legendSections.length > 0 ? (
            <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
              <MarkLegend
                sections={model.legendSections}
                canvasWidth={legendRight}
                maxHeight={height - YSCALEBAR_LABEL_OFFSET}
                displayId={model.configuration.displayId}
              />
            </g>
          ) : null}
        </>
      }
    />
  )
}
