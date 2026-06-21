import { isNumber } from './isNumber.ts'
import {
  bufferToLines,
  computeBedColumns,
  parseExtraCols,
  parseStrand,
} from './util.ts'

// the first 6 BED columns are positionally standard, so name them even when the
// file has no `#` header (extra columns past these are read from the header or
// fall back to field_N)
const coreColumns = ['refName', 'start', 'end', 'name', 'score', 'strand']

export function parseBedBuffer(buffer: Uint8Array) {
  const { rest, extraNames, columns } = computeBedColumns(
    bufferToLines(buffer),
    coreColumns,
  )
  return {
    columns,
    rowSet: {
      rows: rest.map((line, idx) => {
        const cols = line.split('\t')
        const extra = parseExtraCols(cols, extraNames, coreColumns.length)
        const start = +cols[1]!
        const end = +cols[2]!
        const score = isNumber(cols[4]) ? +cols[4] : cols[4]
        return {
          cellData: {
            refName: cols[0],
            start,
            end,
            name: cols[3],
            score,
            strand: cols[5],
            ...extra,
          },
          feature: {
            uniqueId: `bed-${idx}`,
            refName: cols[0]!,
            start,
            end,
            name: cols[3],
            score,
            strand: parseStrand(cols[5]),
            ...extra,
          },
        }
      }),
    },
  }
}
