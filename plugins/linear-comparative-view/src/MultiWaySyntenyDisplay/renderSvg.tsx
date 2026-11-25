/* eslint-disable react-refresh/only-export-components */
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgHaloText, TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk } from '@jbrowse/synteny-core'

import { SvgLaneHeaders } from './components/SvgLaneHeaders.tsx'
import { GENE_LABEL_FONT_PX, GENE_LABEL_HALO_PX } from './laneLabels.ts'
import { MULTIWAY_MARKS, multiwayBlocks } from './multiwayMarks.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

// the export path's lazy boundary: the model reaches this through one import()
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
  const fontFamily = opts?.fontFamily || undefined
  // canvasWidth here too: the lane blocks span it
  const state = {
    ...model.renderState,
    canvasWidth,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    laneMaps: new Map(),
  }
  const { dragOffsetPx } = state
  const ink = bandInk().text
  const halo = bandGroundColor()
  // laid out across the export's width, which is the view's rather than the
  // track's, with the bands on the export theme's page, which need not be the
  // session's
  const figure = model.figureAt(canvasWidth, palette.background.paper)
  return (
    <>
      <MarkSvgLayer
        marks={MULTIWAY_MARKS}
        regions={figure.cells}
        blocks={multiwayBlocks(state)}
        state={state}
        width={canvasWidth}
        height={height}
        opts={opts}
      />
      <g transform={`translate(0 ${-model.scrollTop})`}>
        <SvgLaneHeaders
          rows={model.laneHeaderRows}
          width={canvasWidth}
          fontFamily={fontFamily}
        />
        {model
          .laneGeneLabels(fontFamily, new Set(), figure.labels)
          .map(label => (
            <SvgHaloText
              key={label.key}
              x={label.left + dragOffsetPx}
              y={label.top + GENE_LABEL_FONT_PX * TEXT_BASELINE_RATIO}
              fontSize={GENE_LABEL_FONT_PX}
              fill={ink}
              halo={halo}
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
            fill={ink}
            halo={halo}
            haloWidth={GENE_LABEL_HALO_PX * 2}
          >
            {title.text}
          </SvgHaloText>
        ))}
      </g>
    </>
  )
}
