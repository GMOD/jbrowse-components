/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { SvgLaneHeaders } from './components/SvgLaneHeaders.tsx'
import { MULTIWAY_MARKS, multiwayBlocks } from './multiwayMarks.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

// the lazy boundary for the export path: the model's renderSvg reaches this
// through one import(). The paint layer runs the same Canvas2D draw the
// fallback backend runs, over the same cells and render state — less the
// hover and the click, which are the pointer's and not the figure's, and any
// lane still moving, which the figure draws settled
export async function renderMultiWaySvg(
  model: MultiWaySyntenyDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, MultiWaySvgBody)
}

function MultiWaySvgBody({
  model,
  height,
  canvasWidth,
  opts,
}: LgvSvgBodyProps<MultiWaySyntenyDisplayModel>) {
  const palette = usePalette()
  const state = {
    ...model.renderState,
    canvasWidth,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    laneMaps: new Map(),
  }
  return (
    <>
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          paintMarkBlocks(
            ctx,
            MULTIWAY_MARKS,
            model.renderCells,
            multiwayBlocks(state),
            state,
          )
        }}
      />
      <g transform={`translate(0 ${-model.scrollTop})`}>
        <SvgLaneHeaders
          rows={model.laneHeaderRows}
          width={canvasWidth}
          palette={palette}
        />
      </g>
    </>
  )
}
