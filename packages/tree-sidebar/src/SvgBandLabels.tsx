import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { getFillProps } from '@jbrowse/core/util'

import { fittedLabel } from './fittedLabel.ts'
import { sidebarFontSize } from './rowLabelsBoxWidth.ts'

import type { RowBand } from './arrangeRows.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

const TEXT_PAD = 6

function bandFontSize(text?: ExportTextStyle) {
  return Math.round(0.9 * sidebarFontSize(text))
}

/** Px the band strip takes beside the tree, ahead of the row labels. */
export function bandLabelWidth(text?: ExportTextStyle) {
  return bandFontSize(text) + 3
}

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
  text,
}: {
  bands: readonly RowBand[]
  rowHeight: number
  x: number
  scrollTop?: number
  availableHeight?: number
  text?: ExportTextStyle
}) {
  const palette = usePalette()
  const first = bands[0]
  const last = bands.at(-1)
  if (!first || !last) {
    return null
  }
  const fontSize = bandFontSize(text)
  const width = bandLabelWidth(text)
  const mid = width / 2
  const top = first.start * rowHeight - scrollTop
  return (
    <g data-testid="row_band_labels" transform={`translate(${x} 0)`}>
      <rect
        x={0}
        y={top}
        width={width}
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
        const label = fittedLabel(
          band.label,
          height - TEXT_PAD,
          fontSize,
          text?.fontFamily,
        )
        const cy = y + height / 2
        return (
          <g key={band.key}>
            <title>{band.label}</title>
            <rect
              x={0}
              y={y}
              width={width}
              height={height}
              fill="none"
              pointerEvents="all"
            />
            {label ? (
              <text
                x={mid}
                y={cy}
                transform={`rotate(-90 ${mid} ${cy})`}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                {...getFillProps(palette.text.primary)}
              >
                {label}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}
