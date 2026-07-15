/* eslint-disable react-refresh/only-export-components */
import type React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import {
  CrossHatchLines,
  YSCALEBAR_LABEL_OFFSET,
  YScaleBar,
} from '@jbrowse/wiggle-core'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'
import SvgLdLegend from './components/SvgLdLegend.tsx'

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
  renderState: ManhattanRenderState
  regionTooLarge: boolean
  ldColoringActive: boolean
  showLdLegend: boolean
  displayCrossHatches: boolean
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
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
  const { ticks, rpcDataMap, renderState, displayCrossHatches } = model

  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty scatter with the
  // y-axis drawn only when there are real `ticks`.
  const legendEl = ticks ? (
    <g transform={`translate(${scalebarLeft})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  ) : null

  const ldLegendEl =
    model.ldColoringActive && model.showLdLegend ? (
      <SvgLdLegend width={view.width} />
    ) : null

  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  // canvasHeight tracks the export height, not the on-screen one, so an
  // overrideHeight export scales the scatter instead of drawing it at the
  // display's height inside a taller/shorter frame
  const drawHeight = height - 2 * YSCALEBAR_LABEL_OFFSET
  const state = { ...renderState, canvasWidth, canvasHeight: drawHeight }

  return (
    <>
      <SvgClipRect
        id={`manhattan-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
          <PaintLayer
            width={canvasWidth}
            height={drawHeight}
            opts={opts}
            paint={ctx => {
              drawManhattanBlocks(ctx, rpcDataMap, renderBlocks, state)
            }}
          />
        </g>
      </SvgClipRect>
      {/* Y-scale cross-hatches, shared with the on-screen path so an exported
          SVG matches the track when the option is enabled. Tick y-positions
          already include YSCALEBAR_LABEL_OFFSET, aligning with the canvas group. */}
      {displayCrossHatches && ticks ? (
        <CrossHatchLines ticks={ticks} width={canvasWidth} />
      ) : null}
      {legendEl}
      {ldLegendEl}
    </>
  )
}
