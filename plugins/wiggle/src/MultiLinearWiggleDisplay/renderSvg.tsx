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
import { SvgTreePath } from '@jbrowse/tree-sidebar'

import MultiWiggleSvgScales from './MultiWiggleSvgScales.tsx'
import { drawWiggleToCtx } from '../shared/Canvas2DWiggleRenderer.ts'
import { buildSourceRenderData } from '../shared/buildSourceRenderData.ts'

import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  model: MultiLinearWiggleDisplayModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LGV
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome error={model.error} width={view.width} height={height}>
      <MultiWiggleSvgBody
        model={model}
        view={view}
        height={height}
        opts={opts}
      />
    </SvgChrome>
  )
}

function MultiWiggleSvgBody({
  model,
  view,
  height,
  opts,
}: {
  model: MultiLinearWiggleDisplayModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions | undefined
}) {
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const { rpcDataMap, domain, numSources, renderState } = model

  if (rpcDataMap.size === 0 || !domain || numSources === 0 || !renderState) {
    return null
  }

  const { hierarchy, showTree, treeAreaWidth } = model
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0
  const scalesEl = (
    <MultiWiggleSvgScales
      model={model}
      canvasWidth={view.width}
      scalebarLeft={scalebarLeft}
      labelOffset={labelOffset}
    />
  )

  const treeEl =
    showTree && hierarchy ? <SvgTreePath hierarchy={hierarchy} /> : null

  const props = model.gpuProps()
  // canvas spans the viewport (visibleRegions coords are viewport-relative and
  // clipped to view.width below), matching the on-screen canvas rather than the
  // full-genome totalWidthPx
  const canvasWidth = view.width
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = {
    ...renderState,
    canvasWidth,
    canvasHeight: height,
  }
  const wiggleNode = paintLayer(canvasWidth, height, opts, ctx => {
    drawWiggleToCtx(
      ctx,
      { rpcDataMap, encode: data => buildSourceRenderData(data, props) },
      renderBlocks,
      state,
    )
  })

  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        {wiggleNode}
      </SvgClipRect>
      {scalesEl}
      {treeEl}
    </>
  )
}
