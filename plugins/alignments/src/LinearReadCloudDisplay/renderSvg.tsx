import type React from 'react'

import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import {
  ReactRendering,
  renderingToSvg,
} from '@jbrowse/core/util/offscreenCanvasUtils'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { SVGLegend } from '@jbrowse/plugin-linear-genome-view'

import { calculateCloudTicks } from '../RenderLinearReadCloudDisplayRPC/drawFeatsCloud.ts'
import CloudYScaleBar from './components/CloudYScaleBar.tsx'

import type { LinearReadCloudDisplayModel } from './model.ts'
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
  cloudMaxDistance?: number
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
      ...self.renderProps(),
      cloudModeHeight: height,
      exportSVG: opts,
      theme: opts.theme,
    },
  )) as RenderingResult

  const finalRendering = await renderingToSvg(
    rendering,
    view.staticBlocks.totalWidthPx,
    height,
  )

  // Clip to the visible region (view width), not the full staticBlocks width
  const visibleWidth = view.width

  // Create a clip path to clip to the visible region
  const clipId = `clip-${self.id}-svg`

  // Get legend items if legend is enabled
  const legendItems = self.showLegend ? self.legendItems() : []

  // Compute cloudTicks for SVG export if in cloud mode
  // Use [1, maxDistance] as domain since it's a log scale
  const cloudDomain =
    rendering.cloudMaxDistance !== undefined && self.drawCloud
      ? ([1, rendering.cloudMaxDistance] as [number, number])
      : null
  const cloudTicks =
    cloudDomain && self.showYScalebar
      ? calculateCloudTicks(cloudDomain, height)
      : null

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
