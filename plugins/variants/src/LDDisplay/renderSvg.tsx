import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import LDColumnZone from './components/LDColumnZone.tsx'
import { LD_MARKS } from './components/ldMarks.ts'

import type { SharedLDModel } from './shared.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  self: SharedLDModel,
  opts: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, LdSvgBody)
}

function LdSvgBody({
  model: self,
  height,
  opts,
}: LgvSvgBodyProps<SharedLDModel>) {
  const { ldRegions, ldBlocks, renderState, effectiveLineZoneHeight } = self

  // The live canvas's own box (`canvasWidth`), not the raw viewport width, so
  // the export paints the matrix where the genome is when it doesn't fill the
  // viewport or spans multiple regions.
  const visibleWidth = self.canvasWidth
  const triangleHeight = height - effectiveLineZoneHeight

  return (
    <SvgClipRect
      id={`ld-clip-${svgNodeId(self)}`}
      width={visibleWidth}
      height={height}
    >
      <g transform={`translate(0 ${effectiveLineZoneHeight})`}>
        <PaintLayer
          width={visibleWidth}
          height={triangleHeight}
          opts={opts}
          // Reuse the model's renderState so the export shares one source of
          // truth for the transform and fit-to-height yScalar with the
          // on-screen render. svgReady gates on a fresh viewport, so
          // viewScale === 1 and viewOffsetX === max(0, -offsetPx) — the left
          // gap when the region doesn't reach the viewport edge — which keeps
          // the triangle aligned with the connector lines and VariantLabels.
          // The same narrowing the live upload uses, rather than a
          // hand-built one, so the export cannot pack the matrix differently
          // from the screen.
          paint={ctx => {
            paintMarkBlocks(ctx, LD_MARKS, ldRegions, ldBlocks, renderState)
          }}
        />
      </g>
      <LDColumnZone model={self} exportSVG opts={opts} />
    </SvgClipRect>
  )
}
