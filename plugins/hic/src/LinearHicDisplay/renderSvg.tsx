/* eslint-disable react-refresh/only-export-components */
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
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

  // Reuse the model's renderState so the export shares one source of truth for
  // the transform, yScalar, and color params with the on-screen render (handles
  // scrolled-left-of-genome and stale zoom). Canvas dims are the only
  // export-specific override, and drawHicBlocks ignores them regardless.
  const matrixEl = paintLayer(visibleWidth, height, opts, ctx => {
    drawHicBlocks(ctx, { positions, counts, numContacts }, fillStyleLut, {
      ...renderState,
      canvasWidth: visibleWidth,
      canvasHeight: height,
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
          positionOutside={opts.legendWidth !== undefined}
          idSuffix={self.id}
        />
      ) : null}
    </>
  )
}
