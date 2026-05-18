import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { YSCALEBAR_LABEL_OFFSET, YScaleBar } from '@jbrowse/wiggle-core'
import { when } from 'mobx'

import { drawManhattanToCtx } from './Canvas2DManhattanRenderer.ts'

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
    () =>
      model.manhattanData.size > 0 || !!model.error || model.regionTooLarge,
  )
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const height = model.height
  const { ticks, manhattanData } = model
  const renderState = model.manhattanRenderState()

  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={view.width} height={height} />
    )
  }

  if (manhattanData.size === 0 || !renderState) {
    return null
  }

  const legendEl = ticks ? (
    <g transform={`translate(${scalebarLeft})`}>
      <YScaleBar ticks={ticks} orientation="left" />
    </g>
  ) : null

  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const drawHeight = height - 2 * YSCALEBAR_LABEL_OFFSET
  const state = {
    ...renderState,
    canvasWidth: totalWidth,
    canvasHeight: drawHeight,
  }
  const manhattanNode = (
    <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
      {paintLayer(totalWidth, drawHeight, opts, ctx => {
        drawManhattanToCtx(ctx, manhattanData, renderBlocks, state)
      })}
    </g>
  )

  if (opts?.rasterizeLayers) {
    return (
      <>
        {manhattanNode}
        {legendEl}
      </>
    )
  }

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
