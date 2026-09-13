import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { canvasWideBlocks } from '@jbrowse/render-core/renderBlock'

import LDColumnZone from './components/LDColumnZone.tsx'
import { LD_MARKS } from './components/ldMarks.ts'

import type { SharedLDModel } from './shared.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

export async function renderSvg(
  self: SharedLDModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(self, opts, LdSvgBody)
}

function LdSvgBody({
  model: self,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<SharedLDModel>) {
  const { ldRegions, renderState, effectiveLineZoneHeight } = self
  // the model's transform and yScalar, painted into a layer of the export's
  // width, as the Hi-C export does
  const exportState = { ...renderState, canvasWidth }
  return (
    <SvgClipRect
      id={`ld-clip-${svgNodeId(self)}`}
      width={canvasWidth}
      height={height}
    >
      <g transform={`translate(0 ${effectiveLineZoneHeight})`}>
        <PaintLayer
          width={canvasWidth}
          height={height - effectiveLineZoneHeight}
          opts={opts}
          paint={ctx => {
            paintMarkBlocks(
              ctx,
              LD_MARKS,
              ldRegions,
              canvasWideBlocks([0], canvasWidth),
              exportState,
            )
          }}
        />
      </g>
      <LDColumnZone model={self} exportSVG opts={opts} />
    </SvgClipRect>
  )
}
