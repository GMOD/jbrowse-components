import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SVGErrorBox,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'

import {
  buildTextColors,
  drawSequenceBlocks,
} from './components/drawSequence.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'

import type { DrawSequenceState } from './components/drawSequence.ts'
import type { SequenceRegionData } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
  SvgExportable,
} from '@jbrowse/plugin-linear-genome-view'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

type LGV = LinearGenomeViewModel

interface SequenceDisplayModel extends SvgExportable {
  id: string
  height: number
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderBlocks: RenderBlock[]
  renderState: DrawSequenceState
  // terminal "zoom in" message state, folded into svgReady via
  // svgReadyExtraTerminal; still read here to skip painting bases
  zoomedOut: boolean
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  const view = getContainingView(model) as LGV

  await awaitSvgReady(model)

  if (model.error) {
    return (
      <SVGErrorBox
        error={model.error}
        width={view.width}
        height={model.height}
      />
    )
  }

  const { sequenceData } = model
  if (sequenceData.size === 0 || model.zoomedOut) {
    return null
  }

  // The export theme can differ from the session theme, so rebuild the
  // palette/text colors here and reuse the rest of the live renderState.
  const theme = createJBrowseTheme(opts?.theme)
  const palette = buildColorPalette(theme, view.colorByCDS)
  const textColors = buildTextColors(palette, theme)
  const totalWidth = view.trackWidthPx
  const height = model.height
  const state: DrawSequenceState = { ...model.renderState, palette, textColors }

  // Sequence is text-heavy; routed through paintLayer so rasterizeLayers can
  // PNG-embed when set, but the default (vector) path keeps letters crisp.
  const node = paintLayer(totalWidth, height, opts, ctx => {
    drawSequenceBlocks(ctx, sequenceData, model.renderBlocks, state)
  })

  return (
    <SvgClipRect
      id={`sequence-clip-${model.id}`}
      width={view.width}
      height={height}
    >
      {node}
    </SvgClipRect>
  )
}
