import {
  parseStarFusionBreakpoint,
  starFusionColumns,
} from '@jbrowse/core/util/starFusion'

import { isNumber } from './isNumber.ts'
import { bufferToLines } from './util.ts'

export function parseSTARFusionBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  if (!lines[0]) {
    return { columns: [], rowSet: { rows: [] } }
  }
  const columns = starFusionColumns(lines[0])
  return {
    columns: columns.map(c => ({ name: c })),
    rowSet: {
      rows: lines.slice(1).map((line, rowNumber) => {
        const cols = line.split('\t')
        const row = Object.fromEntries(
          columns.map((h, i) => [h, isNumber(cols[i]) ? +cols[i] : cols[i]!]),
        )
        return {
          cellData: row,
          feature: {
            uniqueId: `sf-${rowNumber}`,
            type: 'fusion',
            ...parseStarFusionBreakpoint(row.LeftBreakpoint as string, true),
            mate: parseStarFusionBreakpoint(
              row.RightBreakpoint as string,
              false,
            ),
          },
        }
      }),
    },
  }
}
