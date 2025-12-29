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

import HicSVGColorLegend from './components/HicSVGColorLegend'

import type { LinearHicDisplayModel } from './model'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderingResult {
  reactElement?: React.ReactNode
  html?: string
  canvasRecordedData?: unknown
  maxScore?: number
}

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  const session = getSession(self)
  const { rpcManager } = session
  const height = opts.overrideHeight ?? self.height

  const { useLogScale, colorScheme, showLegend, adapterConfig } = self
  const { bpPerPx, dynamicBlocks } = view
  const regions = dynamicBlocks.contentBlocks

  if (!regions.length) {
    return null
  }

  const renderProps = self.renderProps()

  // Call CoreRender RPC method (same as afterAttach uses)
  // Use getRpcSessionId to ensure we use the same worker as normal rendering
  const rpcSessionId = getRpcSessionId(self)
  const rendering = (await rpcManager.call(rpcSessionId, 'CoreRender', {
    sessionId: rpcSessionId,
    rendererType: 'HicRenderer',
    regions: [...regions],
    adapterConfig,
    bpPerPx,
    highResolutionScaling: 2,
    exportSVG: opts,
    ...renderProps,
  })) as RenderingResult

  const finalRendering = await renderingToSvg(
    rendering,
    view.staticBlocks.totalWidthPx,
    height,
  )

  // Clip to the visible region (view width), not the full staticBlocks width
  const visibleWidth = view.width

  // Create a clip path to clip to the visible region
  const clipId = `clip-${self.id}-svg`

  // Use maxScore from rendering result or from model
  const maxScore = rendering.maxScore ?? self.maxScore

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
      {showLegend && maxScore > 0 ? (
        <HicSVGColorLegend
          maxScore={maxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          legendAreaWidth={opts.legendWidth}
        />
      ) : null}
    </>
  )
}
