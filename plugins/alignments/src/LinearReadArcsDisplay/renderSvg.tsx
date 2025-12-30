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

import type { LinearReadArcsDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderingResult {
  reactElement?: React.ReactNode
  html?: string
  canvasRecordedData?: unknown
}

export async function renderSvg(
  self: LinearReadArcsDisplayModel,
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
    'RenderLinearReadArcsDisplay',
    {
      sessionId: rpcSessionId,
      view: viewSnapshot,
      adapterConfig: self.adapterConfig,
      sequenceAdapter,
      config: getSnapshot(self.configuration),
      ...self.renderProps(),
      height,
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
  // Apply clipping BEFORE transform, at the view level
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
