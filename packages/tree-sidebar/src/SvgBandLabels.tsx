import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getFillProps } from '@jbrowse/core/util'

import { fittedLabel } from './fittedLabel.ts'

import type { RowBand } from './arrangeRows.ts'

/** Px the band strip takes beside the tree, ahead of the row labels. */
export const BAND_LABEL_WIDTH = 14

const FONT_SIZE = 11
const TEXT_PAD = 6

/**
 * The bands' strip in the margin: one column beside the tree, each band's name
 * written up its rows (ggplot2's `strip.position = "left"`, ComplexHeatmap's
 * `row_title`), cut short with an ellipsis where the band is too short for
 * it, and whole on hover. One background rect under every band, since a rect
 * per band blends twice at a fractional boundary.
 */
export function SvgBandLabels({
  bands,
  rowHeight,
  x,
  scrollTop = 0,
  availableHeight,
}: {
  bands: readonly RowBand[]
  rowHeight: number
  x: number
  scrollTop?: number
  availableHeight?: number
}) {
  const palette = usePalette()
  const first = bands[0]
  const last = bands.at(-1)
  if (!first || !last) {
    return null
  }
  const mid = BAND_LABEL_WIDTH / 2
  const top = first.start * rowHeight - scrollTop
  return (
    <g data-testid="row_band_labels" transform={`translate(${x} 0)`}>
      <rect
        x={0}
        y={top}
        width={BAND_LABEL_WIDTH}
        height={(last.end - first.start) * rowHeight}
        {...getFillProps(alpha(palette.background.paper, 0.8))}
      />
      {bands.map(band => {
        const y = band.start * rowHeight - scrollTop
        const height = (band.end - band.start) * rowHeight
        const offscreen =
          availableHeight !== undefined &&
          (y + height < 0 || y > availableHeight)
        if (offscreen) {
          return null
        }
        const text = fittedLabel(band.label, height - TEXT_PAD, FONT_SIZE)
        const cy = y + height / 2
        return (
          <g key={band.key} style={{ pointerEvents: 'auto' }}>
            <title>{band.label}</title>
            <rect
              x={0}
              y={y}
              width={BAND_LABEL_WIDTH}
              height={height}
              fill="transparent"
            />
            {text ? (
              <text
                x={mid}
                y={cy}
                transform={`rotate(-90 ${mid} ${cy})`}
                fontSize={FONT_SIZE}
                textAnchor="middle"
                dominantBaseline="central"
                {...getFillProps(palette.text.primary)}
              >
                {text}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
