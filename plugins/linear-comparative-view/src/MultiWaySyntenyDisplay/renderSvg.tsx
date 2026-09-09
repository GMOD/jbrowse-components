import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import MultiWayOverlay from './components/MultiWayOverlay.tsx'
import { MULTIWAY_MARKS, multiwayBlocks } from './multiwayMarks.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

// the lazy boundary for the export path: the model's renderSvg reaches this
// through one import(). The paint layer runs the same Canvas2D draw the
// fallback backend runs, over the same cells and render state — less the
// hover and the click, which are the pointer's and not the figure's
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
              const state = {
                ...model.renderState,
                hoveredFeatureId: 0,
                clickedFeatureId: 0,
              }
              paintMarkBlocks(
                ctx,
                MULTIWAY_MARKS,
                model.renderCells,
                multiwayBlocks(state),
                state,
              )
            }}
          />
          <MultiWayOverlay model={model} exportSVG />
        </SvgClipRect>
      )
    },
  )
}
