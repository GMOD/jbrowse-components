import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import { drawMultiWay } from './Canvas2DMultiWayRenderer.ts'
import MultiWayOverlay from './components/MultiWayOverlay.tsx'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

// the lazy boundary for the export path: the model's renderSvg reaches this
// through one import(). The paint layer runs the same Canvas2D draw the
// fallback backend runs, over the same cells and render state
export async function renderMultiWaySvg(
  model: MultiWaySyntenyDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(
    model,
    opts,
    function MultiWaySvgBody(
      props: LgvSvgBodyProps<MultiWaySyntenyDisplayModel>,
    ) {
      const { model, height, opts } = props
      const width = model.canvasWidth
      return (
        <SvgClipRect
          id={`multiway-${svgNodeId(model)}`}
          width={width}
          height={height}
        >
          <PaintLayer
            width={width}
            height={height}
            opts={opts}
            paint={ctx => {
              drawMultiWay(ctx, model.renderCells, model.renderState)
            }}
          />
          <MultiWayOverlay model={model} exportSVG />
        </SvgClipRect>
      )
    },
  )
}
