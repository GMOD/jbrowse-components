import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

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
  showReverse: boolean
  showTranslation: boolean
  isDna: boolean
  sequenceType: string
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

  const ctx = new SvgCanvas()
  drawSequenceBlocks(ctx, sequenceData, model.renderBlocks, {
    bpPerPx: view.bpPerPx,
    showForward: model.showForward,
    showReverse: model.isDna && model.showReverse,
    showTranslation: model.isDna && model.showTranslation,
    sequenceType: model.sequenceType,
    rowHeight: model.rowHeight,
    palette,
    textColors,
    canvasWidth: view.trackWidthPx,
    canvasHeight: model.height,
  })

  const clipId = `sequence-clip-${model.id}`
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={view.width} height={model.height} />
        </clipPath>
      </defs>
      <g
        clipPath={`url(#${clipId})`}
        dangerouslySetInnerHTML={{ __html: ctx.getSerializedSvg() }}
      />
    </g>
  )
}
