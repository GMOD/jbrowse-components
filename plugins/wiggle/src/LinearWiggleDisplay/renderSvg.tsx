/* eslint-disable react-refresh/only-export-components */
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

import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import ScoreLegend from '../shared/ScoreLegend.tsx'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'

import type { LinearWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: LinearWiggleDisplayModel,
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
  const { ticks, rpcDataMap, domain, renderState, displayCrossHatches } = model

  const props = model.gpuProps()
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const drawHeight = height - 2 * YSCALEBAR_LABEL_OFFSET
  const state = {
    ...renderState,
    canvasWidth,
    canvasHeight: drawHeight,
  }

  // No data-size gate: renderState is always defined (a [0,1] stub until
  // autoscale resolves), so an empty region paints an empty plot. The axis and
  // legend are drawn only once a real `domain` / `ticks` exist.
  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        <g transform={`translate(0,${YSCALEBAR_LABEL_OFFSET})`}>
          <PaintLayer
            width={canvasWidth}
            height={drawHeight}
            opts={opts}
            paint={ctx => {
              drawWiggleToCtx(
                ctx,
                {
                  rpcDataMap,
                  encode: data => buildSourceRenderData(data, props),
                },
                renderBlocks,
                state,
              )
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
      {model.isDensityMode ? (
        domain ? (
          <ScoreLegend
            domain={domain}
            scaleType={model.scaleType}
            canvasWidth={view.width}
          />
        ) : null
      ) : ticks ? (
        <g transform={`translate(${scalebarLeft})`}>
          <YScaleBar ticks={ticks} orientation="left" />
        </g>
      ) : null}
    </>
  )
}
