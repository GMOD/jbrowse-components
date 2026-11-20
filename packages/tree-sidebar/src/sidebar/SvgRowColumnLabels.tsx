import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getFillProps } from '@jbrowse/core/util'
import { TEXT_BASELINE_RATIO } from '@jbrowse/display-ui'

import {
  COLUMN_LABEL_TEXT_GAP,
  columnLabelFontSize,
  columnLabelTextX,
  rowColorColumnCenters,
  ROW_COLUMN_LABEL_LINE_HEIGHT,
} from './rowLabelsBoxWidth.ts'

import type { RowAnnotationColumn, LabelledRow } from '../types.ts'
import type { ExportTextStyle } from '@jbrowse/display-kit/types'

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
  rows,
  rowHeight,
  labelOffset,
  annotations,
  text,
}: {
  labels: readonly string[]
  rows: readonly LabelledRow[]
  rowHeight: number
  labelOffset: number
  annotations?: readonly RowAnnotationColumn[]
  text?: ExportTextStyle
}) {
  const palette = usePalette()
  const centers = rowColorColumnCenters(rows, rowHeight, annotations)
  const textX = columnLabelTextX(centers)
  const fontSize = columnLabelFontSize(text)
  const baselineDrop = fontSize * (TEXT_BASELINE_RATIO - 0.5)
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
          d={`M${x - 0.5} ${y - 0.5}H${textX - COLUMN_LABEL_TEXT_GAP}v1H${x + 0.5}V0h-1z`}
          {...getFillProps(palette.text.secondary)}
        />
      ))}
      {columns.map(({ label, x, y }) => (
        <text
          key={x}
          data-testid="row-column-label"
          x={textX}
          y={y + baselineDrop}
          fontSize={fontSize}
          {...getFillProps(palette.text.primary)}
        >
          {label}
        </text>
      ))}
    </g>
  ) : null
}
