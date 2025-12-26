import type React from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  ReactRendering,
  getSerializedSvg,
} from '@jbrowse/core/util/offscreenCanvasUtils'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { SVGLegend } from '@jbrowse/plugin-linear-genome-view'

import type { LinearReadCloudDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderingResult {
  reactElement?: React.ReactNode
  html?: string
  canvasRecordedData?: unknown
  layoutHeight?: number
  featuresForFlatbush?: unknown
}

export async function renderSvg(
  self: LinearReadCloudDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  const session = getSession(self)
  const { rpcManager } = session
  const height = opts.overrideHeight ?? self.height

  const {
    featureHeightSetting: featureHeight,
    colorBy,
    filterBy,
    drawSingletons,
    drawProperPairs,
    flipStrandLongReadChains,
    noSpacing,
    trackMaxHeight,
  } = self

  // Serialize the full view snapshot for RPC
  // Include staticBlocks and width which are not part of the regular snapshot
  const viewSnapshot = structuredClone({
    ...getSnapshot(view),
    staticBlocks: view.staticBlocks,
    width: view.width,
  })

  // Call RPC method with exportSVG options
  const rendering = (await rpcManager.call(
    self.id,
    'RenderLinearReadCloudDisplay',
    {
      sessionId: session.id,
      view: viewSnapshot,
      adapterConfig: self.adapterConfig,
      config: getSnapshot(self.configuration),
      theme: opts.theme,
      filterBy,
      featureHeight,
      noSpacing: noSpacing ?? false,
      drawCloud: self.drawCloud,
      colorBy,
      drawSingletons,
      drawProperPairs,
      flipStrandLongReadChains,
      trackMaxHeight,
      height,
      exportSVG: opts,
      rpcDriverName: self.effectiveRpcDriverName,
    },
  )) as RenderingResult

  // Convert canvasRecordedData to SVG if present (vector SVG mode)
  let finalRendering = rendering
  if (rendering.canvasRecordedData && !rendering.html) {
    const html = await getSerializedSvg({
      width: view.staticBlocks.totalWidthPx,
      height,
      canvasRecordedData: rendering.canvasRecordedData,
    })
    finalRendering = { ...rendering, html }
  }

  // Clip to the visible region (view width), not the full staticBlocks width
  const visibleWidth = view.width

  // Create a clip path to clip to the visible region
  const clipId = `clip-${self.id}-svg`

  // Get legend items if legend is enabled
  const legendItems = self.showLegend ? self.legendItems() : []

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${Math.max(0, -view.offsetPx)} 0)`}>
          <ReactRendering rendering={finalRendering} />
        </g>
      </g>
      {legendItems.length > 0 ? (
        <SVGLegend
          items={legendItems}
          width={visibleWidth}
          legendAreaWidth={opts.legendWidth}
        />
      ) : null}
    </>
  )
}
