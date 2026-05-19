import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
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
  const {
    rpcData,
    useLogScale,
    colorScheme,
    showLegend,
    yScalar,
    colorMaxScore,
  } = self
  if (!rpcData || rpcData.numContacts === 0) {
    return null
  }

  const { positions, counts, numContacts, binWidth } = rpcData
  const height = opts.overrideHeight ?? self.height
  const visibleWidth = view.width
  const ramp = generateColorRamp(colorScheme)

  // Reuse the model's renderTransform so SVG export aligns identically to
  // the on-screen render (handles scrolled-left-of-genome and stale zoom).
  const { scale: viewScale, viewOffsetX } = self.renderTransform
  const matrixEl = paintLayer(visibleWidth, height, opts, ctx => {
    drawHicBlocks(ctx, { positions, counts, numContacts }, ramp, {
      binWidth,
      yScalar,
      canvasWidth: visibleWidth,
      canvasHeight: height,
      colorMaxScore,
      useLogScale,
      viewScale,
      viewOffsetX,
    })
  })

  return (
    <>
      <SvgClipRect
        id={`hic-clip-${self.id}`}
        width={visibleWidth}
        height={height}
      >
        {matrixEl}
      </SvgClipRect>
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
