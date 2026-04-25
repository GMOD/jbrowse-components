import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { when } from 'mobx'

import { drawHicBlocks } from './components/Canvas2DHicRenderer.ts'
import HicSVGColorLegend from './components/HicSVGColorLegend.tsx'
import { generateColorRamp } from './components/colorRamp.ts'

import type { LinearHicDisplayModel } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  const view = getContainingView(self) as LGV
  await when(() => self.rpcData != null || !!self.error || self.regionTooLarge)
  const { rpcData, useLogScale, colorScheme, showLegend, yScalar } = self
  if (!rpcData || rpcData.numContacts === 0) {
    return null
  }

  const { positions, counts, numContacts, colorMaxScore, binWidth } = rpcData
  const height = opts.overrideHeight ?? self.height
  const visibleWidth = view.width
  const ramp = generateColorRamp(colorScheme)
  const clipId = `clip-${self.id}-svg`

  const matrixEl = paintLayer(visibleWidth, height, opts, ctx => {
    drawHicBlocks(
      ctx,
      { positions, counts, numContacts },
      ramp,
      {
        binWidth,
        yScalar,
        canvasWidth: visibleWidth,
        canvasHeight: height,
        colorMaxScore,
        useLogScale,
        viewScale: 1,
        viewOffsetX: 0,
      },
    )
  })

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={visibleWidth} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{matrixEl}</g>
      {showLegend && colorMaxScore > 0 ? (
        <HicSVGColorLegend
          maxScore={colorMaxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          legendAreaWidth={opts.legendWidth}
        />
      ) : null}
    </>
  )
}
