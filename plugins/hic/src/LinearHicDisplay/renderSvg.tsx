import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
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
  LgvSvgBodyProps,
} from '@jbrowse/plugin-linear-genome-view'

export async function renderSvg(
  self: LinearHicDisplayModel,
  opts: ExportSvgDisplayOptions,
) {
  // renderDisplaySvg's awaitSvgReady (GlobalFetchMixin) waits out an
  // in-place refetch — which holds stale rpcData until the new result commits —
  // so exports never capture a partial or stale viewport.
  return renderDisplaySvg(self, opts, HicSvgBody)
}

function HicSvgBody({
  model: self,
  height,
  canvasWidth: visibleWidth,
  opts,
}: LgvSvgBodyProps<LinearHicDisplayModel>) {
  const {
    rpcData,
    colorScheme,
    showLegendArea,
    useLogScale,
    colorMaxScore,
    renderState,
  } = self
  // svgReady + SvgChrome already guarantee a loaded, non-terminal state here, so
  // this narrows the nullable fetch blob for TS only — unreachable at runtime.
  // An empty (numContacts === 0) result still paints an empty matrix.
  if (!rpcData) {
    return null
  }

  const fillStyleLut = makeHicFillStyleLut(generateColorRamp(colorScheme))

  // Reuse the model's renderState so the export shares one source of truth for
  // the transform, color params, and fit-to-height yScalar with the on-screen
  // render (handles scrolled-left-of-genome and stale zoom).
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
            drawHicBlocks(ctx, rpcData, fillStyleLut, renderState, visibleWidth)
          }}
        />
      </SvgClipRect>
      {showLegendArea ? (
        <HicSVGColorLegend
          maxScore={colorMaxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
          width={visibleWidth}
          // >0 means the container reserved a legend area to the right (it
          // maxes svgLegendWidth() across tracks). Absent/0 — e.g. the synteny
          // and breakpoint exports, which don't reserve any — floats the legend
          // over the plot instead.
          positionOutside={(opts?.legendWidth ?? 0) > 0}
          idSuffix={self.id}
        />
      ) : null}
    </>
  )
}
