/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { paintMarkBlocks } from '@jbrowse/render-core/marks'

import { drawSequenceLetters } from './components/drawSequenceLetters.ts'
import { encodeSequenceCells } from './components/sequenceCells.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'
import { SEQUENCE_MARKS } from './components/sequenceMarks.ts'

import type { SequenceRenderState } from './components/sequenceGeometry.ts'
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
  if (model.placeholderMessage) {
    return null
  }

  // the export theme can differ from the session's
  const state: SequenceRenderState = {
    ...model.renderState,
    // the width this layer paints at, which is the block scissor bound
    canvasWidth,
    palette: buildColorPalette(
      resolvePalette({ configTheme: opts?.theme }),
      model.view.colorByCDS,
    ),
  }
  const { displayedRegions } = model.view
  const cells = new Map(
    [...sequenceData].map(([key, data]) => [
      key,
      encodeSequenceCells(data, state, !!displayedRegions[key]?.reversed),
    ]),
  )

  // PaintLayer stays vector by default and PNG-embeds under rasterizeLayers
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
