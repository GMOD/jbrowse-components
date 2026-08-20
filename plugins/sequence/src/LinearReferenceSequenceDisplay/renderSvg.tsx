import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'

import { drawSequenceBlocks } from './components/drawSequence.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'

import type { DrawSequenceState } from './components/drawSequence.ts'
import type { SequenceRegionData } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
  SvgExportable,
} from '@jbrowse/plugin-linear-genome-view'

interface SequenceDisplayModel extends SvgExportable {
  id: string
  height: number
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderState: DrawSequenceState
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
  view,
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
  const state: DrawSequenceState = {
    ...model.renderState,
    // canvasWidth is the block scissor bound, so it has to be the width this
    // layer is actually painted at — see LgvSvgBodyProps.canvasWidth.
    canvasWidth,
    palette: buildColorPalette(
      resolvePalette({ configTheme: opts?.theme }),
      view.colorByCDS,
    ),
  }

  // Sequence is text-heavy; routed through PaintLayer so rasterizeLayers can
  // PNG-embed when set, but the default (vector) path keeps letters crisp.
  return (
    <SvgClipRect
      id={`sequence-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          drawSequenceBlocks(ctx, sequenceData, renderBlocks, state)
        }}
      />
    </SvgClipRect>
  )
}
