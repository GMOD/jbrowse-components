import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { FloatingText, TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { TEXT_MARK_FONT_PX, placeTextMarks } from '../textMarks.ts'

import type { MarkDisplayModel } from './markDisplayTypes.ts'

/**
 * The text marks' labels over the plot, as DOM text: one element per label
 * the shared placement keeps, in the instance's colour with a halo in the
 * surface colour, and no pointer events, so a hover reaches the canvas under
 * it. Its own observer, so a pan re-places the labels and nothing else.
 */
const MarkTextLayer = observer(function MarkTextLayer({
  model,
  yTop,
  plotHeight,
}: {
  model: MarkDisplayModel
  yTop: number
  plotHeight: number
}) {
  const { palette, typography } = useStyleTheme()
  if (!model.markTypes.includes('text')) {
    return null
  }
  const font = { size: TEXT_MARK_FONT_PX, family: typography.fontFamily }
  const labels = placeTextMarks(
    model.textMarkEntries,
    model.rpcDataMap,
    model.renderBlocks,
    model.renderState,
    font,
    palette.text.primary,
  )
  return (
    <div
      data-testid="mark-text-layer"
      style={{
        position: 'absolute',
        top: yTop,
        left: 0,
        width: model.canvasWidthPx,
        height: plotHeight,
        overflow: 'hidden',
        pointerEvents: 'none',
        fontFamily: font.family,
      }}
    >
      {labels.map(label => (
        <FloatingText
          key={`${label.regionIndex}-${label.markIndex}-${label.instance}`}
          data-testid="mark-text"
          x={label.x - label.width / 2}
          y={label.baseline - font.size * TEXT_BASELINE_RATIO}
          color={label.color}
          fontSize={font.size}
          halo={palette.background.paper}
        >
          {label.text}
        </FloatingText>
      ))}
    </div>
  )
})

export default MarkTextLayer
