/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { drawSequenceLetters } from './components/drawSequenceLetters.ts'
import { encodeSequenceCells } from './components/sequenceCells.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'
import { SEQUENCE_MARKS } from './components/sequenceMarks.ts'

import type { SequenceRenderState } from './components/drawSequenceLetters.ts'
import type { CellEncoding } from './components/sequenceCells.ts'
import type { SequenceRegionData } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'
import type {
  LinearGenomeViewModel,
  SvgExportable,
} from '@jbrowse/plugin-linear-genome-view'

interface SequenceDisplayModel extends SvgExportable {
  id: string
  view: LinearGenomeViewModel
  height: number
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderState: SequenceRenderState
  cellEncoding: CellEncoding
  // terminal static-message state (zoomed past base resolution, or every row
  // toggled off), folded into svgReady via fetchInert; still read
  // here to skip painting bases
  placeholderMessage: string | undefined
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, SequenceSvgBody)
}

function SequenceSvgBody({
  model,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<SequenceDisplayModel>) {
  const { sequenceData } = model
  // the terminal static-message state (no fetch); an empty but loaded
  // sequenceData still paints naturally below.
  if (model.placeholderMessage) {
    return null
  }

  // The export theme can differ from the session theme, so rebuild the palette
  // here and reuse the rest of the live renderState.
  const state: SequenceRenderState = {
    ...model.renderState,
    // canvasWidth is the block scissor bound, so it has to be the width this
    // layer is actually painted at — see LgvSvgBodyProps.canvasWidth.
    canvasWidth,
    palette: buildColorPalette(
      resolvePalette({ configTheme: opts?.theme }),
      model.view.colorByCDS,
    ),
  }

  const encoding = { ...model.cellEncoding, palette: state.palette }
  const { displayedRegions } = model.view
  const cells = new Map(
    [...sequenceData].map(([key, data]) => [
      key,
      encodeSequenceCells(data, encoding, !!displayedRegions[key]?.reversed),
    ]),
  )

  // routed through PaintLayer so rasterizeLayers can PNG-embed when set, but
  // the default (vector) path keeps letters crisp
  return (
    <PaintLayer
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={ctx => {
        paintMarkBlocks(ctx, SEQUENCE_MARKS, cells, renderBlocks, state)
        drawSequenceLetters(ctx, sequenceData, renderBlocks, state)
      }}
    />
  )
}
