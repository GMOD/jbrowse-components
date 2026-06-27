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

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import ScoreLegend from '../shared/ScoreLegend.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome error={model.error} width={view.width} height={height}>
      <WiggleSvgBody model={model} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function WiggleSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: LinearWiggleDisplayModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const { ticks, rpcDataMap, domain, renderState } = model

  if (rpcDataMap.size === 0 || !domain || !renderState) {
    return null
  }

  let legendEl: React.ReactNode = null
  if (model.isDensityMode) {
    legendEl = (
      <ScoreLegend
        domain={domain}
        scaleType={model.scaleType}
        canvasWidth={view.width}
      />
    )
  } else if (ticks) {
    legendEl = (
      <g transform={`translate(${scalebarLeft})`}>
        <YScaleBar ticks={ticks} orientation="left" />
      </g>
    )
  }

  const props = model.gpuProps()
  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const drawHeight = height - 2 * YSCALEBAR_LABEL_OFFSET
  const state = {
    ...renderState,
    canvasWidth: totalWidth,
    canvasHeight: drawHeight,
  }
  const wiggleNode = (
    <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
      {paintLayer(totalWidth, drawHeight, opts, ctx => {
        drawWiggleToCtx(
          ctx,
          { rpcDataMap, encode: data => buildSourceRenderData(data, props) },
          renderBlocks,
          state,
        )
      })}
    </g>
  )

  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        {wiggleNode}
      </SvgClipRect>
      {legendEl}
    </>
  )
}
