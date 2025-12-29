import type React from 'react'

import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import {
  ReactRendering,
  getSerializedSvg,
} from '@jbrowse/core/util/offscreenCanvasUtils'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { SVGLegend } from '@jbrowse/plugin-linear-genome-view'

import CloudYScaleBar from './components/CloudYScaleBar'

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
  cloudScaleInfo?: { minDistance: number; maxDistance: number }
}

export async function renderSvg(
  self: LinearReadCloudDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  const session = getSession(self)
  const { rpcManager, assemblyManager } = session
  const height = opts.overrideHeight ?? self.height

  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
  const sequenceAdapter = sequenceAdapterConfig
    ? getSnapshot(sequenceAdapterConfig)
    : undefined

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
  // Use getRpcSessionId to ensure we use the same worker as normal rendering
  const rpcSessionId = getRpcSessionId(self)
  const rendering = (await rpcManager.call(
    rpcSessionId,
    'RenderLinearReadCloudDisplay',
    {
      sessionId: rpcSessionId,
      view: viewSnapshot,
      adapterConfig: self.adapterConfig,
      sequenceAdapter,
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
      cloudModeHeight: height,
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

  // Compute cloudTicks for SVG export if in cloud mode
  let cloudTicks: {
    ticks: { value: number; y: number }[]
    height: number
    minDistance: number
    maxDistance: number
  } | null = null

  if (self.drawCloud && rendering.cloudScaleInfo && self.showYScalebar) {
    const { minDistance, maxDistance } = rendering.cloudScaleInfo
    const CLOUD_LOG_OFFSET = 10
    const CLOUD_HEIGHT_PADDING = 20

    const maxD = Math.log(maxDistance + CLOUD_LOG_OFFSET)
    const minD = Math.log(Math.max(1, minDistance + CLOUD_LOG_OFFSET))
    const scaler = (height - CLOUD_HEIGHT_PADDING) / (maxD - minD || 1)

    const tickValues: number[] = []
    const log2Min = Math.floor(Math.log2(minDistance))
    const log2Max = Math.ceil(Math.log2(maxDistance))

    for (let power = log2Min; power <= log2Max; power++) {
      const value = Math.pow(2, power)
      if (value >= minDistance && value <= maxDistance) {
        tickValues.push(value)
      }
    }

    const uniqueTicks = [...new Set(tickValues)].sort((a, b) => a - b)
    const ticks = uniqueTicks.map(value => {
      const y = (Math.log(value + CLOUD_LOG_OFFSET) - minD) * scaler
      return { value, y }
    })

    cloudTicks = { ticks, height, minDistance, maxDistance }
  }

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
      {cloudTicks ? (
        <g transform={`translate(${Math.max(-view.offsetPx, 0)})`}>
          <CloudYScaleBar model={{ cloudTicks }} orientation="left" />
        </g>
      ) : null}
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
