import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  ReactRendering,
  getSerializedSvg,
} from '@jbrowse/core/util/offscreenCanvasUtils'

import type { LinearReadCloudDisplayModel } from './model'
import type {
  LinearGenomeViewModel,
  ExportSvgDisplayOptions,
} from '@jbrowse/plugin-linear-genome-view'
import type React from 'react'

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
  const assemblyName = view.assemblyNames[0]
  if (!assemblyName) {
    return null
  }

  const { bpPerPx, offsetPx } = view
  const width = view.staticBlocks.totalWidthPx
  // Use overrideHeight from opts if provided, otherwise use display's height
  const height = opts.overrideHeight ?? (self.drawCloud ? self.height : self.layoutHeight)
  const regions = view.staticBlocks.contentBlocks
  // Use theme from opts if provided, otherwise use session theme
  const theme = opts.theme ?? session.theme

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

  // Call RPC method with exportSVG options
  const rendering = (await rpcManager.call(
    self.id,
    'RenderLinearReadCloudDisplay',
    {
      sessionId: session.id,
      regions,
      adapterConfig: self.adapterConfig,
      config: self.configuration,
      theme,
      filterBy,
      featureHeight,
      noSpacing: noSpacing ?? false,
      drawCloud: self.drawCloud,
      colorBy,
      drawSingletons,
      drawProperPairs,
      flipStrandLongReadChains,
      trackMaxHeight,
      width,
      height,
      bpPerPx,
      offsetPx,
      assemblyName,
      exportSVG: opts,
    },
  )) as RenderingResult

  // Convert canvasRecordedData to SVG if present (vector SVG mode)
  let finalRendering = rendering
  if (rendering.canvasRecordedData && !rendering.html) {
    const html = await getSerializedSvg({
      width,
      height,
      canvasRecordedData: rendering.canvasRecordedData,
    })
    finalRendering = { ...rendering, html }
  }

  // Calculate positioning offset
  // Use the first content block's offsetPx to position the rendering
  // offsetPx is the current view scroll position
  // The offset positions our rendered content correctly in the SVG
  const staticBlocksOffsetPx = view.staticBlocks.contentBlocks[0]?.offsetPx ?? 0
  const viewOffsetPx = offsetPx
  const offset = staticBlocksOffsetPx - viewOffsetPx

  // Clip to the visible region (view width), not the full staticBlocks width
  const visibleWidth = view.width

  // Create a clip path to clip to the visible region
  // Apply clipping BEFORE transform, at the view level
  const clipId = `clip-${self.id}-svg`

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(${offset} 0)`}>
          <ReactRendering rendering={finalRendering} />
        </g>
      </g>
    </>
  )
}
