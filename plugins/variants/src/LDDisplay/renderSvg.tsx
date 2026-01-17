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
import SVGRecombinationTrack from './components/SVGRecombinationTrack.tsx'

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
  recombination?: {
    values: number[]
    positions: number[]
  }
}

export async function renderSvg(
  self: LDDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  const session = getSession(self)
  const { rpcManager } = session
  const height = opts.overrideHeight ?? self.height

  const {
    ldMetric,
    showLegend,
    adapterConfig,
    showRecombination,
    recombinationZoneHeight,
  } = self
  const { bpPerPx, dynamicBlocks } = view
  const regions = dynamicBlocks.contentBlocks

  if (!regions.length) {
    return null
  }

  const region = regions[0]!
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

  const recombinationOffset = showRecombination ? recombinationZoneHeight : 0
  const ldHeight = height - recombinationOffset

  const finalRendering = await renderingToSvg(
    rendering,
    view.staticBlocks.totalWidthPx,
    ldHeight,
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
        {showRecombination && rendering.recombination ? (
          <SVGRecombinationTrack
            recombination={rendering.recombination}
            width={visibleWidth}
            height={recombinationZoneHeight}
            bpPerPx={bpPerPx}
            regionStart={region.start}
          />
        ) : null}
        <g transform={`translate(${Math.max(0, -view.offsetPx)} ${recombinationOffset})`}>
          <ReactRendering rendering={finalRendering} />
        </g>
        <LinesConnectingMatrixToGenomicPosition
          model={self}
          exportSVG
          yOffset={recombinationOffset}
        />
      </g>
      {showLegend ? (
        <LDSVGColorLegend ldMetric={ldMetric} width={visibleWidth} />
      ) : null}
    </>
  )
}
