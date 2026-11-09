import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getFillProps } from '@jbrowse/core/util'

import {
  ROW_COLUMN_LABEL_LINE_HEIGHT,
  rowColorColumnCenters,
  rowLabelFontSize,
} from './rowLabelsBoxWidth.ts'

import type { RowAnnotationColumn, RowLabelSource } from './types.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

const TICK_LENGTH = 4
const TEXT_GAP = 2

/**
 * The label over each color column beside the row labels, a line each above
 * the first row (y 0), the first column's on the top line. A 1 px leader
 * drops from each label's line to its column's center, and every label
 * starts right of the last leader, so no column is wider for its label and no
 * leader crosses one. Drawn on screen and in the export, at every row
 * height; the mixin's `rowColumnLabels` says which columns, and its
 * `rowsTopOffset` starts the rows under these lines.
 */
export function SvgRowColumnLabels({
  labels,
  sources,
  rowHeight,
  labelOffset,
  annotations,
  text,
}: {
  labels: readonly string[]
  sources: readonly RowLabelSource[]
  rowHeight: number
  labelOffset: number
  annotations?: readonly RowAnnotationColumn[]
  text?: ExportTextStyle
}) {
  const palette = usePalette()
  const centers = rowColorColumnCenters(sources, rowHeight, annotations)
  const textX = (centers.at(-1) ?? 0) + TICK_LENGTH + TEXT_GAP
  const columns = labels.flatMap((label, column) => {
    const x = centers[column]
    return x === undefined
      ? []
      : [
          {
            label,
            x,
            y: (column - labels.length + 0.5) * ROW_COLUMN_LABEL_LINE_HEIGHT,
          },
        ]
  })
  return columns.length ? (
    <g
      transform={`translate(${labelOffset} 0)`}
      style={{ pointerEvents: 'none' }}
    >
      {columns.map(({ x, y }) => (
        <path
          key={x}
          data-testid="row-column-leader"
          d={`M${x - 0.5} ${y - 0.5}H${textX - TEXT_GAP}v1H${x + 0.5}V0h-1z`}
          {...getFillProps(palette.text.secondary)}
        />
      ))}
      {columns.map(({ label, x, y }) => (
        <text
          key={x}
          data-testid="row-column-label"
          x={textX}
          y={y}
          fontSize={rowLabelFontSize(ROW_COLUMN_LABEL_LINE_HEIGHT, text)}
          dominantBaseline="central"
          {...getFillProps(palette.text.primary)}
        >
          {label}
        </text>
      ))}
    </g>
  ) : null
}
