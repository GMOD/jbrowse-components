/* eslint-disable react-refresh/only-export-components */
import type React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { YSCALEBAR_LABEL_OFFSET, YScaleBar } from '@jbrowse/wiggle-core'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'
import { LD_LEGEND } from './ldBins.ts'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

type LGV = LinearGenomeViewModel

// Duck-typed model contract: importing the full LinearManhattanDisplayModel
// here would close a type cycle (factory return type → renderSvg action →
// model instance → factory return type), so we depend only on the fields read.
interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  ticks?: YScaleTicks
  rpcDataMap: ReadonlyMap<number, ManhattanRpcResult>
  renderState?: ManhattanRenderState
  regionTooLarge: boolean
  colorBy: 'normal' | 'ld'
  showLdLegend: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome error={model.error} width={view.width} height={height}>
      <ManhattanSvgBody model={model} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function ManhattanSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: RenderSvgModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const { ticks, rpcDataMap } = model
  const { renderState } = model

  if (rpcDataMap.size === 0 || !renderState) {
    return null
  }

  const legendEl = ticks ? (
    <g transform={`translate(${scalebarLeft})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  ) : null

  const ROW_H = 14
  const SWATCH = 10
  const ldLegendEl =
    model.colorBy === 'ld' && model.showLdLegend ? (
      <g
        transform={`translate(${view.width - 84},${YSCALEBAR_LABEL_OFFSET + 4})`}
      >
        <rect
          x={-4}
          y={-4}
          width={88}
          height={ROW_H + LD_LEGEND.length * ROW_H + 4}
          fill="rgba(255,255,255,0.85)"
          stroke="#ccc"
          strokeWidth={0.5}
          rx={2}
        />
        <text fontSize={10} fontWeight="bold" y={ROW_H - 4}>
          r² to index
        </text>
        {LD_LEGEND.map(({ label, color }, i) => (
          <g key={label} transform={`translate(0,${ROW_H + i * ROW_H})`}>
            <rect
              width={SWATCH}
              height={SWATCH}
              fill={color}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={0.5}
            />
            <text fontSize={10} x={SWATCH + 4} y={SWATCH - 1}>
              {label}
            </text>
          </g>
        ))}
      </g>
    ) : null

  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = { ...renderState, canvasWidth }
  const manhattanNode = (
    <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
      {paintLayer(canvasWidth, renderState.canvasHeight, opts, ctx => {
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
      </SvgClipRect>
      {legendEl}
      {ldLegendEl}
    </>
  )
}
