import { renderWiggleFamilySvg } from '@jbrowse/plugin-wiggle'
import { YScaleBar } from '@jbrowse/wiggle-core'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'
import SvgLdLegend from './components/SvgLdLegend.tsx'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { WiggleFamilySvgModel } from '@jbrowse/plugin-wiggle'
import type React from 'react'

// Duck-typed model contract: importing the full LinearManhattanDisplayModel
// here would close a type cycle (factory return type → renderSvg action →
// model instance → factory return type), so we depend only on the fields read
// (the shared SvgChrome/axis/cross-hatch fields via WiggleFamilySvgModel, plus
// the Manhattan-specific paint/legend inputs below).
interface RenderSvgModel extends WiggleFamilySvgModel {
  rpcDataMap: ReadonlyMap<number, ManhattanRpcResult>
  renderState: ManhattanRenderState
  ldColoringActive: boolean
  showLdLegend: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  return renderWiggleFamilySvg({
    model,
    opts,
    clipIdPrefix: 'manhattan',
    paint: (ctx, { canvasWidth, drawHeight, renderBlocks }) => {
      const state = {
        ...model.renderState,
        canvasWidth,
        canvasHeight: drawHeight,
      }
      drawManhattanBlocks(ctx, model.rpcDataMap, renderBlocks, state)
    },
    // left y-axis (Manhattan is always linear, never density) plus the r² key
    // when LD coloring is active
    legend: ({ scalebarLeft, canvasWidth, ticks }) => (
      <>
        {ticks ? (
          <g transform={`translate(${scalebarLeft})`}>
            <YScaleBar ticks={ticks} orientation="left" />
          </g>
        ) : null}
        {model.ldColoringActive && model.showLdLegend ? (
          <SvgLdLegend width={canvasWidth} />
        ) : null}
      </>
    ),
  })
}
