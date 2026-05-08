import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { buildTextColors, drawSequenceToCtx } from './components/drawSequence.ts'
import { buildColorPalette } from './components/sequenceGeometry.ts'

import type { SequenceRegionData } from './model.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface SequenceDisplayModel {
  id: string
  height: number
  sequenceData: Map<number, SequenceRegionData>
  showForwardActual: boolean
  showReverseActual: boolean
  showTranslationActual: boolean
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
  drawSequenceToCtx(ctx, view, {
    sequenceData,
    showForward: model.showForwardActual,
    showReverse: model.showReverseActual,
    showTranslation: model.showTranslationActual,
    sequenceType: model.sequenceType,
    rowHeight: model.rowHeight,
    palette,
    textColors,
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
