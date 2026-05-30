import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import {
  YSCALEBAR_LABEL_OFFSET,
  YScaleBar,
  waitForRenderableState,
} from '@jbrowse/wiggle-core'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { SignificanceLine } from './significanceLines.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

type LGV = LinearGenomeViewModel

// Duck-typed model contract: importing the full LinearManhattanDisplayModel
// here would close a type cycle (factory return type → renderSvg action →
// model instance → factory return type), so we depend only on the fields read.
interface RenderSvgModel {
  id: string
  height: number
  ticks?: YScaleTicks
  rpcDataMap: ReadonlyMap<number, ManhattanRpcResult>
  renderState?: ManhattanRenderState
  significanceLines: SignificanceLine[]
  error: unknown
  regionTooLarge: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await waitForRenderableState(model)
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const height = model.height
  const { ticks, rpcDataMap } = model
  const { renderState } = model

  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={view.width} height={height} />
    )
  }

  if (rpcDataMap.size === 0 || !renderState) {
    return null
  }

  const legendEl = ticks ? (
    <g transform={`translate(${scalebarLeft})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  ) : null

  // Same full-height coordinate space as the YScaleBar (line y already
  // includes the label offset), so no translate is applied here.
  const significanceEl =
    model.significanceLines.length > 0 ? (
      <g>
        {model.significanceLines.map(line => (
          <line
            key={line.label}
            x1={0}
            x2={view.width}
            y1={line.y}
            y2={line.y}
            stroke={line.color}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}
      </g>
    ) : null

  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  // SVG export spans all visible regions side-by-side, so canvasWidth is
  // overridden to the full bp window width — canvasHeight is the same as
  // on-screen.
  const state = { ...renderState, canvasWidth: totalWidth }
  const manhattanNode = (
    <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
      {paintLayer(totalWidth, renderState.canvasHeight, opts, ctx => {
        drawManhattanBlocks(ctx, rpcDataMap, renderBlocks, state)
      })}
    </g>
  )

  return (
    <>
      <SvgClipRect
        id={`manhattan-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        {manhattanNode}
        {significanceEl}
      </SvgClipRect>
      {legendEl}
    </>
  )
}
