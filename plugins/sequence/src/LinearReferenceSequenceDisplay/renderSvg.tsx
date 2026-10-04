/* eslint-disable react-refresh/only-export-components */
import { SVGMessageBox } from '@jbrowse/core/svg/SvgExport'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import MarkSvgLayer from '@jbrowse/display-kit/MarkSvgLayer'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'

import { drawSequenceLetters } from './components/drawSequenceLetters.ts'
import { encodeSequenceCells } from './components/sequenceCells.ts'
import { SEQUENCE_MARKS } from './components/sequenceMarks.ts'

import type {
  ColorPalette,
  SequenceRenderState,
} from './components/sequenceGeometry.ts'
import type { SequenceRegionData } from './model.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type {
  LgvSvgBodyProps,
  LgvSvgExportable,
} from '@jbrowse/display-kit/renderDisplaySvg'
import type { ExportSvgDisplayOptions } from '@jbrowse/display-kit/types'

interface SequenceDisplayModel extends LgvSvgExportable {
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderState: SequenceRenderState
  colorPaletteIn: (palette: JBrowsePalette) => ColorPalette
  placeholderMessage: string | undefined
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  return renderDisplaySvg(model, opts, SequenceSvgBody)
}

// Where the screen shows its placeholder — zoomed out, or every row off — the
// export says so too, as it says a region is too large.
function SequenceSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<SequenceDisplayModel>) {
  const palette = usePalette()
  const { sequenceData, placeholderMessage } = model
  if (placeholderMessage) {
    return (
      <SVGMessageBox
        message={placeholderMessage}
        width={canvasWidth}
        height={height}
      />
    )
  }
  const state = { ...model.renderState, palette: model.colorPaletteIn(palette) }
  const cells = new Map(
    [...sequenceData].map(([key, data]) => [
      key,
      encodeSequenceCells(data, state, !!view.displayedRegions[key]?.reversed),
    ]),
  )
  return (
    <MarkSvgLayer
      marks={SEQUENCE_MARKS}
      regions={cells}
      blocks={renderBlocks}
      state={state}
      width={canvasWidth}
      height={height}
      opts={opts}
      paint={(ctx, framed) => {
        drawSequenceLetters(ctx, sequenceData, renderBlocks, framed)
      }}
    />
  )
}
