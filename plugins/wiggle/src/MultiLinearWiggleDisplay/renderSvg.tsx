import type React from 'react'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SVGErrorBox, SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { SvgRowLabels, SvgTreePath } from '@jbrowse/tree-sidebar'
import { when } from 'mobx'

import { buildMultiSourceRenderData } from './components/buildMultiSourceRenderData.ts'
import {
  Canvas2DWiggleRenderer,
  drawWiggleBlocks,
} from '../shared/Canvas2DWiggleRenderer.ts'
import DensityLegend from '../shared/DensityLegend.tsx'
import OverlayColorLegend from '../shared/OverlayColorLegend.tsx'
import ScoreLegend from '../shared/ScoreLegend.tsx'
import YScaleBar from '../shared/YScaleBar.tsx'
import { getRowTop } from '../shared/wiggleComponentUtils.ts'

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
  await when(
    () => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge,
  )
  const { offsetPx } = view
  // anchors scale bars to left edge of content; non-zero only when scrolled before genome start
  const scalebarLeft = Math.max(-offsetPx, 0)
  const height = model.height
  const {
    ticks,
    rpcDataMap,
    domain,
    scaleType,
    numSources,
    isOverlay,
    rowHeight,
    renderState,
  } = model

  if (model.error) {
    return (
      <SVGErrorBox error={model.error} width={view.width} height={height} />
    )
  }

  if (rpcDataMap.size === 0 || !domain || numSources === 0 || !renderState) {
    return null
  }

  const totalWidth = view.totalWidthPx

  let legendEl: React.ReactNode = null
  if (model.isDensityMode) {
    legendEl = (
      <DensityLegend
        domain={domain}
        scaleType={scaleType}
        canvasWidth={view.width}
      />
    )
  } else if (ticks) {
    if (rowHeight < 70) {
      legendEl = (
        <ScoreLegend
          ticks={ticks}
          scaleType={scaleType}
          canvasWidth={view.width}
        />
      )
    } else if (isOverlay) {
      legendEl = (
        <g transform={`translate(${scalebarLeft})`}>
          <YScaleBar model={model} orientation="left" />
        </g>
      )
    } else {
      legendEl = (
        <g transform={`translate(${scalebarLeft})`}>
          {Array.from({ length: numSources }).map((_, idx) => (
            <g
              key={`scalebar-${idx}`}
              transform={`translate(0 ${getRowTop(idx, rowHeight)})`}
            >
              <YScaleBar model={model} orientation="left" />
            </g>
          ))}
        </g>
      )
    }
  }

  const sources = model.sources
  const { hierarchy, showTree, treeAreaWidth } = model
  const labelOffset = showTree && hierarchy ? treeAreaWidth : 0
  let labelsEl: React.ReactNode = null
  if (sources.length > 1) {
    labelsEl = isOverlay ? (
      <OverlayColorLegend
        sources={sources}
        fallbackColor={model.posColor}
        canvasWidth={view.width}
      />
    ) : (
      <SvgRowLabels
        sources={sources}
        rowHeight={rowHeight}
        labelOffset={labelOffset}
      />
    )
  }

  const treeEl =
    showTree && hierarchy ? <SvgTreePath hierarchy={hierarchy} /> : null

  // Headless renderer: same drawWiggleBlocks pipeline as on-screen.
  // buildMultiSourceRenderData converts RPC data + gpuProps → SourceRenderData[]
  // (one per row); the renderer paints each source at rowIndex × rowHeight.
  const props = model.gpuProps()
  const renderer = new Canvas2DWiggleRenderer(null)
  for (const [displayedRegionIndex, data] of rpcDataMap) {
    renderer.uploadRegion(
      displayedRegionIndex,
      buildMultiSourceRenderData(data, props),
    )
  }

  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = {
    ...renderState,
    canvasWidth: totalWidth,
    canvasHeight: height,
  }

  const wiggleNode = paintLayer(totalWidth, height, opts, ctx => {
    drawWiggleBlocks(ctx, renderer.getRegions(), renderBlocks, state)
  })

  if (opts?.rasterizeLayers) {
    return (
      <>
        {wiggleNode}
        {labelsEl}
        {legendEl}
        {treeEl}
      </>
    )
  }

  return (
    <>
      <SvgClipRect
        id={`wiggle-clip-${model.id}`}
        width={view.width}
        height={height}
      >
        {wiggleNode}
      </SvgClipRect>
      {labelsEl}
      {legendEl}
      {treeEl}
    </>
  )
}
