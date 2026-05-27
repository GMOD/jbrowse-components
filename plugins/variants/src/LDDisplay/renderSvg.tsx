import { getContainingView, max } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

import { drawLDBlocks } from './components/Canvas2DLDRenderer.ts'
import { LDSVGColorLegend } from './components/LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './components/LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './components/VariantLabels.tsx'
import Wrapper from './components/Wrapper.tsx'
import { generateLDColorRamp } from './components/ldColorRamp.ts'
import RecombinationTrack from '../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../shared/components/RecombinationYScaleBar.tsx'

import type { SharedLDModel } from './shared.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  self: SharedLDModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  await when(() => self.rpcData != null || !!self.error || self.regionTooLarge)
  const { rpcData } = self
  const height = opts.overrideHeight ?? self.height

  const {
    ldMetric,
    showLegend,
    showRecombination,
    lineZoneHeight,
    effectiveLineZoneHeight,
    useGenomicPositions,
    signedLD,
    yScalar,
  } = self

  if (!rpcData || rpcData.numCells === 0) {
    return null
  }

  const { ldValues, boundaries, numCells, uniformW } = rpcData
  const visibleWidth = view.width
  const ramp = generateLDColorRamp(rpcData.metric, rpcData.signedLD)
  const triangleHeight = height - effectiveLineZoneHeight

  const matrixEl = paintLayer(visibleWidth, triangleHeight, opts, ctx => {
    drawLDBlocks(ctx, { ldValues, boundaries, numCells }, ramp, {
      yScalar,
      canvasWidth: visibleWidth,
      canvasHeight: triangleHeight,
      signedLD,
      viewScale: 1,
      viewOffsetX: 0,
      uniformW,
    })
  })

  // Match the live overlay's layout: genomic-positions mode places the
  // recombination plot at the top spanning effectiveLineZoneHeight; index
  // mode tucks it in the lower half of lineZoneHeight, above the matrix.
  const recombTrackHeight = useGenomicPositions
    ? effectiveLineZoneHeight
    : lineZoneHeight / 2
  const recombTrackYOffset = useGenomicPositions ? 0 : lineZoneHeight / 2

  return (
    <>
      <SvgClipRect
        id={`ld-clip-${self.id}`}
        width={visibleWidth}
        height={height}
      >
        <g transform={`translate(0 ${effectiveLineZoneHeight})`}>{matrixEl}</g>
        {useGenomicPositions ? (
          <Wrapper model={self} exportSVG>
            <VariantLabels model={self} />
          </Wrapper>
        ) : (
          <LinesConnectingMatrixToGenomicPosition model={self} exportSVG />
        )}
        {showRecombination && rpcData.recombination ? (
          <g transform={`translate(0 ${recombTrackYOffset})`}>
            <RecombinationTrack
              recombination={rpcData.recombination}
              width={visibleWidth}
              height={recombTrackHeight}
              exportSVG
              useGenomicPositions={useGenomicPositions}
              regionStart={view.dynamicBlocks.contentBlocks[0]?.start}
              bpPerPx={view.bpPerPx}
            />
            <RecombinationYScaleBar
              height={recombTrackHeight}
              maxValue={max(rpcData.recombination.values, 0.1)}
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
