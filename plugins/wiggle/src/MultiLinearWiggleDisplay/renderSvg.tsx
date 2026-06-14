import type React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'
import { SvgTreePath } from '@jbrowse/tree-sidebar'
import { waitForRenderableState } from '@jbrowse/wiggle-core'

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
  const view = getContainingView(model) as LGV
  await waitForRenderableState(model)
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const height = model.height
  const { rpcDataMap, domain, numSources, renderState } = model

  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={view.width} height={height} />
    )
  }

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
  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = {
    ...renderState,
    canvasWidth: totalWidth,
    canvasHeight: height,
  }
  const wiggleNode = paintLayer(totalWidth, height, opts, ctx => {
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
