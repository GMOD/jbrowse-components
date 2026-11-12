import { rowColumnLabelsHeight } from '../sidebar/rowLabelsBoxWidth.ts'
import { rowFieldValue } from './rowColorScale.ts'

import type { RowSource } from '../types.ts'
import type { RowAnnotationSetting } from './rowColorScale.ts'

/**
 * More distinct numbers than this, on more than half the rows carrying the
 * field, read as a quantity rather than categories: past a palette's length
 * the colors only repeat.
 */
const CONTINUOUS_DISTINCT_VALUES = 10

function continuousValueCount(rows: readonly RowSource[], field: string) {
  const values = rows
    .map(row => rowFieldValue(row, field))
    .filter(value => value !== '')
  const distinct = new Set(values).size
  return distinct > CONTINUOUS_DISTINCT_VALUES &&
    distinct * 2 > values.length &&
    values.every(value => Number.isFinite(Number(value)))
    ? distinct
    : 0
}

/**
 * What a display's notice says of its `rows.annotations`, over `rows`, the
 * rows known: an entry on a field no row carries, which draws no column; one
 * on numbers that are mostly distinct, each dealt a color of its own; and
 * column labels taking more than half the track's `height`.
 */
export function rowAnnotationNotices({
  rows,
  settings,
  columnLabels,
  height,
}: {
  rows: readonly RowSource[]
  settings: readonly RowAnnotationSetting[]
  columnLabels: readonly string[]
  height: number
}) {
  const labelsHeight = rowColumnLabelsHeight(columnLabels)
  return rows.length === 0
    ? []
    : [
        ...settings.flatMap(({ field }) => {
          const continuous = continuousValueCount(rows, field)
          return rows.every(row => rowFieldValue(row, field) === '')
            ? [
                `rows.annotations: no row carries "${field}", so it draws no column`,
              ]
            : continuous > 0
              ? [
                  `rows.annotations: "${field}" holds ${continuous} distinct numbers, each dealt a color of its own: an annotation is categorical, and a continuous color scale is not supported`,
                ]
              : []
        }),
        ...(labelsHeight * 2 > height
          ? [
              `rows.annotations: the ${columnLabels.length} column labels take ${labelsHeight} of the track's ${height} px, leaving the rows less than half`,
            ]
          : []),
      ]
}
