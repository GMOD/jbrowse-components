import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { svgLegendAreaReserved } from '@jbrowse/display-kit/types'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import { drawLDBlocks } from './components/Canvas2DLDRenderer.ts'
import LDColumnZone from './components/LDColumnZone.tsx'
import LDSVGColorLegend from './components/LDSVGColorLegend.tsx'
import { generateLDColorRamp } from './components/ldColorRamp.ts'
import { toLDUploadData } from './components/ldRenderingBackendTypes.ts'

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
  const {
    rpcData,
    effectiveLdMetric,
    effectiveSignedLD,
    showLegend,
    effectiveLineZoneHeight,
  } = self

  // svgReady + SvgChrome already guarantee a loaded, non-terminal state here, so
  // this narrows the single nullable fetch blob for TS only — unreachable at
  // runtime. An empty (numCells === 0) result still paints an empty triangle.
  if (!rpcData) {
    return null
  }

  // The live canvas's own box (`canvasWidth`), not the raw viewport width —
  // otherwise the export's legend drifts from the matrix when the genome
  // doesn't fill the viewport or spans multiple regions.
  const visibleWidth = self.canvasWidth
  const ramp = generateLDColorRamp(rpcData.metric, rpcData.signedLD)
  const triangleHeight = height - effectiveLineZoneHeight

  return (
    <>
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
            // The same narrowing the live upload uses, rather than a hand-built
            // one: assembling it here took `signedLD` off the config slot while
            // the ramp beside it took the packed matrix's own convention, so a
            // toggle in flight could remap the values through a ramp built for
            // the other range.
            paint={ctx => {
              drawLDBlocks(ctx, toLDUploadData(rpcData), ramp, self.renderState)
            }}
          />
        </g>
        <LDColumnZone model={self} exportSVG />
      </SvgClipRect>
      {showLegend ? (
        <LDSVGColorLegend
          ldMetric={effectiveLdMetric}
          width={visibleWidth}
          signedLD={effectiveSignedLD}
          idSuffix={self.id}
          positionOutside={svgLegendAreaReserved(opts)}
        />
      ) : null}
    </>
  )
}
