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

import LDSVGColorLegend from './components/LDSVGColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition.tsx'

import type { LDDisplayModel } from './model.ts'
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
  self: LDDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  const session = getSession(self)
  const { rpcManager } = session
  const height = opts.overrideHeight ?? self.height

  const { ldMetric, showLegend, adapterConfig } = self
  const { bpPerPx, dynamicBlocks } = view
  const regions = dynamicBlocks.contentBlocks

  if (!regions.length) {
    return null
  }

  const renderProps = self.renderProps()

  const rpcSessionId = getRpcSessionId(self)
  const rendering = (await rpcManager.call(rpcSessionId, 'CoreRender', {
    sessionId: rpcSessionId,
    rendererType: 'LDRenderer',
    regions: [...regions],
    adapterConfig,
    bpPerPx,
    ...renderProps,
    exportSVG: opts,
  })) as RenderingResult

  const finalRendering = await renderingToSvg(
    rendering,
    view.staticBlocks.totalWidthPx,
    height,
  )

  const visibleWidth = view.width
  const clipId = `clip-${self.id}-svg`

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
        <LinesConnectingMatrixToGenomicPosition model={self} exportSVG />
      </g>
      {showLegend ? (
        <LDSVGColorLegend ldMetric={ldMetric} width={visibleWidth} />
      ) : null}
    </>
  )
}
