import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YSCALEBAR_LABEL_OFFSET, YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import { drawManhattanBlocks } from './Canvas2DManhattanRenderer.ts'

import type { LinearManhattanDisplayModel } from './stateModelFactory.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearManhattanDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  const view = getContainingView(model) as LGV
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )
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
      </SvgClipRect>
      {legendEl}
    </>
  )
}
