/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
  computeTriangleYScalar,
} from '@jbrowse/plugin-linear-genome-view'

import { drawHicBlocks } from './components/Canvas2DHicRenderer.ts'
import HicSVGColorLegend from './components/HicSVGColorLegend.tsx'
import {
  generateColorRamp,
  makeHicFillStyleLut,
} from './components/colorRamp.ts'

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
  // svgReady (GlobalDataDisplayMixin) waits out an in-place refetch — which
  // holds stale rpcData until the new result commits — so exports never capture
  // a partial or stale viewport.
  await awaitSvgReady(self)
  const view = getContainingView(self) as LGV
  const height = opts.overrideHeight ?? self.height
  return (
    <SvgChrome
      error={self.error}
      regionTooLarge={self.regionTooLarge}
      width={view.width}
      height={height}
    >
      <HicSvgBody self={self} view={view} height={height} opts={opts} />
    </SvgChrome>
  )
}

function HicSvgBody({
  self,
  view,
  height,
  opts,
}: {
  self: LinearHicDisplayModel
  view: LGV
  height: number
  opts: ExportSvgDisplayOptions
}) {
  const { rpcData, colorScheme, showLegend, useLogScale, colorMaxScore } = self
  const renderState = self.renderState
  // svgReady + SvgChrome already guarantee a loaded, non-terminal state here, so
  // this narrows the nullable fetch blob / render state for TS only —
  // unreachable at runtime. An empty (numContacts === 0) result still paints an
  // empty matrix.
  if (!rpcData || !renderState) {
    return null
  }

  const { positions, counts, numContacts } = rpcData
  const visibleWidth = view.width
  const fillStyleLut = makeHicFillStyleLut(generateColorRamp(colorScheme))

  // yScalar squashes the triangle to fill the display height, so when the
  // export overrides the height it must be recomputed against that height —
  // renderState.yScalar is keyed to the on-screen height and would mis-size the
  // exported triangle whenever overrideHeight differs (fit-to-height only).
  const yScalar = computeTriangleYScalar({
    fitToHeight: self.fitToHeight,
    displayHeight: height,
    triangleWidth: view.totalWidthPx,
  })

  // Reuse the model's renderState so the export shares one source of truth for
  // the transform and color params with the on-screen render (handles
  // scrolled-left-of-genome and stale zoom); yScalar and the canvas dims are the
  // export-specific overrides.
  return (
    <>
      <SvgClipRect
        id={`hic-clip-${self.id}`}
        width={visibleWidth}
        height={height}
      >
        <PaintLayer
          width={visibleWidth}
          height={height}
          opts={opts}
          paint={ctx => {
            drawHicBlocks(
              ctx,
              { positions, counts, numContacts },
              fillStyleLut,
              {
                ...renderState,
                yScalar,
                canvasWidth: visibleWidth,
                canvasHeight: height,
              },
            )
          }}
        />
      </SvgClipRect>
      {showLegend && colorMaxScore > 0 ? (
        <HicSVGColorLegend
          maxScore={colorMaxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          positionOutside={opts.legendWidth !== undefined}
          idSuffix={self.id}
        />
      ) : null}
    </>
  )
}
