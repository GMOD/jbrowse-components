import type React from 'react'

import { getContainingView, getSession } from '@jbrowse/core/util'
import {
  ReactRendering,
  getSerializedSvg,
} from '@jbrowse/core/util/offscreenCanvasUtils'
import { getSnapshot } from 'mobx-state-tree'

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
  const assemblyName = view.assemblyNames[0]
  if (!assemblyName) {
    return null
  }

  const { offsetPx } = view
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
      config: self.configuration,
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
    },
  )) as RenderingResult

  console.log('renderSvg rendering result:', rendering)

  // Convert canvasRecordedData to SVG if present (vector SVG mode)
  let finalRendering = rendering
  if (rendering.canvasRecordedData && !rendering.html) {
    console.log('Converting canvasRecordedData to SVG')
    const html = await getSerializedSvg({
      width: view.staticBlocks.totalWidthPx,
      height,
      canvasRecordedData: rendering.canvasRecordedData,
    })
    console.log(
      'Generated HTML from canvasRecordedData:',
      html ? 'success' : 'failed',
    )
    finalRendering = { ...rendering, html }
  }

  console.log('finalRendering:', finalRendering)

  // Clip to the visible region (view width), not the full staticBlocks width
  const visibleWidth = view.width

  console.log('SVG positioning debug:', {
    view_staticBlocks_totalWidthPx: view.staticBlocks.totalWidthPx,
    view_width: view.width,
    view_offsetPx: offsetPx,
    contentBlocks: view.staticBlocks.contentBlocks.map(cb => ({
      refName: cb.refName,
      start: cb.start,
      end: cb.end,
      offsetPx: cb.offsetPx,
    })),
  })

  // Create a clip path to clip to the visible region
  const clipId = `clip-${self.id}-svg`

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <ReactRendering rendering={finalRendering} />
      </g>
    </>
  )
}
