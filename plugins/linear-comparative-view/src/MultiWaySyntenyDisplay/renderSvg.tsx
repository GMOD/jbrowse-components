/* eslint-disable react-refresh/only-export-components */
import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgHaloText, TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { sharedBackendKey } from '@jbrowse/render-core/sharedBackendKey'
import { bandGroundColor, bandInk } from '@jbrowse/synteny-core'

import { SvgLaneHeaders } from './components/SvgLaneHeaders.tsx'
import { GENE_LABEL_FONT_PX, GENE_LABEL_HALO_PX } from './laneLabels.ts'
import { BANDS_KEY } from './multiwayGeometry.ts'
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
  const { palette, typography } = useStyleTheme()
  const { fontFamily } = typography
  const state = {
    ...model.renderState,
    canvasWidth,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    laneMaps: new Map(),
  }
  const { dragOffsetPx } = state
  // the bands on the export theme's page, which need not be the session's
  const cells = new Map(model.renderCells)
  cells.set(
    sharedBackendKey(BANDS_KEY),
    model.bandCellOn(palette.background.paper),
  )
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
            cells,
            multiwayBlocks(state),
            state,
          )
        }}
      />
      <g transform={`translate(0 ${-model.scrollTop})`}>
        <SvgLaneHeaders
          rows={model.laneHeaderRows}
          width={canvasWidth}
          fontFamily={fontFamily}
        />
        {model.laneGeneLabels(fontFamily, new Set(), canvasWidth).map(label => (
          <SvgHaloText
            key={label.key}
            x={label.left + dragOffsetPx}
            y={label.top + GENE_LABEL_FONT_PX * TEXT_BASELINE_RATIO}
            fontSize={GENE_LABEL_FONT_PX}
            fontFamily={fontFamily}
            fill={bandInk().text}
            halo={bandGroundColor()}
            haloWidth={GENE_LABEL_HALO_PX * 2}
          >
            {label.text}
          </SvgHaloText>
        ))}
        {model.laneLayerTitles.map(title => (
          <SvgHaloText
            key={`layer-${title.key}`}
            x={4}
            y={title.top + GENE_LABEL_FONT_PX * TEXT_BASELINE_RATIO}
            fontSize={GENE_LABEL_FONT_PX}
            fontFamily={fontFamily}
            fill={bandInk().text}
            halo={bandGroundColor()}
            haloWidth={GENE_LABEL_HALO_PX * 2}
          >
            {title.text}
          </SvgHaloText>
        ))}
      </g>
    </>
  )
}
