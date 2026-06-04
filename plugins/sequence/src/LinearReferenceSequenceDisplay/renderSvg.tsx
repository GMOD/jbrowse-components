import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { paintLayer } from '@jbrowse/core/util/paintLayer'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import {
  buildTextColors,
  drawSequenceBlocks,
} from './components/drawSequence.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'

import type { SequenceRegionData } from './model.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface SequenceDisplayModel {
  id: string
  height: number
  sequenceData: ReadonlyMap<number, SequenceRegionData>
  renderBlocks: RenderBlock[]
  showForward: boolean
  effectiveShowReverse: boolean
  effectiveShowTranslation: boolean
  isDna: boolean
  rowHeight: number
  zoomedOut: boolean
}

export async function renderSvg(
  model: SequenceDisplayModel,
  opts?: ExportSvgDisplayOptions,
) {
  const view = getContainingView(model) as LGV
  const { sequenceData } = model

  if (sequenceData.size === 0 || model.zoomedOut) {
    return null
  }

  const theme = createJBrowseTheme(opts?.theme)
  const palette = buildColorPalette(theme)
  const textColors = buildTextColors(palette, theme)
  const totalWidth = view.trackWidthPx
  const height = model.height

  // Sequence is text-heavy; routed through paintLayer so rasterizeLayers can
  // PNG-embed when set, but the default (vector) path keeps letters crisp.
  const node = paintLayer(totalWidth, height, opts, ctx => {
    drawSequenceBlocks(ctx, sequenceData, model.renderBlocks, {
      bpPerPx: view.bpPerPx,
      showForward: model.showForward,
      showReverse: model.effectiveShowReverse,
      showTranslation: model.effectiveShowTranslation,
      isDna: model.isDna,
      rowHeight: model.rowHeight,
      palette,
      textColors,
      canvasWidth: totalWidth,
      canvasHeight: height,
    })
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
