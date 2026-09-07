import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { svgLegendAreaReserved } from '@jbrowse/display-kit/types'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import HicSVGColorLegend from './components/HicSVGColorLegend.tsx'
import { HIC_MARKS, hicMarkBlocks } from './components/hicMarks.ts'

import type { LinearHicDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, HicSvgBody)
}

function HicSvgBody({
  model: self,
  height,
  canvasWidth: visibleWidth,
  opts,
}: LgvSvgBodyProps<LinearHicDisplayModel>) {
  const {
    hicRegions,
    colorScheme,
    showLegendArea,
    useLogScale,
    colorMaxScore,
    renderState,
  } = self

  // Reuse the model's renderState so the export shares one source of truth for
  // the transform, color params, and fit-to-height yScalar with the on-screen
  // render (handles scrolled-left-of-genome and stale zoom). Its canvas width
  // is the scrolled content's; the export paints a layer of the visible width
  // and the painter culls against whatever box it is given, so that one field
  // is the layer's.
  const exportState = { ...renderState, canvasWidth: visibleWidth }
  return (
    <>
      <SvgClipRect
        id={`hic-clip-${svgNodeId(self)}`}
        width={visibleWidth}
        height={height}
      >
        <PaintLayer
          width={visibleWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            paintMarkBlocks(
              ctx,
              HIC_MARKS,
              hicRegions,
              hicMarkBlocks(visibleWidth),
              exportState,
            )
          }}
        />
      </SvgClipRect>
      {showLegendArea ? (
        <HicSVGColorLegend
          maxScore={colorMaxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          positionOutside={svgLegendAreaReserved(opts)}
          idSuffix={self.id}
        />
      ) : null}
    </>
  )
}
