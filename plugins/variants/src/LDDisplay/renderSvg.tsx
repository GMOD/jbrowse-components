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
import { SvgClipRect } from '@jbrowse/core/util/svgExport'

import { LDSVGColorLegend } from './components/LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './components/VariantLabels.tsx'
import Wrapper from './components/Wrapper.tsx'
import RecombinationTrack from '../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../shared/components/RecombinationYScaleBar.tsx'

import type { SharedLDModel } from './shared.ts'
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
  self: SharedLDModel,
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
    lineZoneHeight,
    useGenomicPositions,
    signedLD,
  } = self
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

  // Recombination track is overlaid at the bottom half of the line zone
  const recombTrackHeight = lineZoneHeight / 2
  const recombTrackYOffset = lineZoneHeight / 2

  return (
    <>
      <SvgClipRect id={clipId} width={visibleWidth} height={height}>
        <g
          transform={`translate(${Math.max(0, -view.offsetPx)} ${lineZoneHeight})`}
        >
          <ReactRendering rendering={finalRendering} />
        </g>
        {useGenomicPositions ? (
          <Wrapper model={self} exportSVG>
            <VariantLabels model={self} />
          </Wrapper>
        ) : (
          <LinesConnectingMatrixToGenomicPosition model={self} exportSVG />
        )}
        {/* Recombination track overlaid at bottom of line zone */}
        {showRecombination && rendering.recombination ? (
          <g transform={`translate(0 ${recombTrackYOffset})`}>
            <RecombinationTrack
              recombination={rendering.recombination}
              width={visibleWidth}
              height={recombTrackHeight}
              exportSVG
              useGenomicPositions={useGenomicPositions}
              regionStart={regions[0]?.start}
              bpPerPx={bpPerPx}
            />
            <RecombinationYScaleBar
              height={recombTrackHeight}
              maxValue={Math.max(...rendering.recombination.values, 0.1)}
              exportSVG
            />
          </g>
        ) : null}
      </SvgClipRect>
      {showLegend ? (
        <LDSVGColorLegend
          ldMetric={ldMetric}
          width={visibleWidth}
          signedLD={signedLD}
        />
      ) : null}
    </>
  )
}
