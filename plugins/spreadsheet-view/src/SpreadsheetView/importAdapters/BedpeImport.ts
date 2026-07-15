import { isNumber } from './isNumber.ts'
import {
  bufferToLines,
  computeBedColumns,
  parseExtraCols,
  parseStrand,
} from './util.ts'

const coreColumns = [
  'refName',
  'start',
  'end',
  'mateRefName',
  'mateStart',
  'mateEnd',
  'name',
  'score',
  'strand',
  'mateStrand',
]

export function parseBedPEBuffer(buffer: Uint8Array) {
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
        const score = isNumber(cols[7]) ? +cols[7] : cols[7]
        const start = +cols[1]!
        const end = +cols[2]!
        const mateStart = +cols[4]!
        const mateEnd = +cols[5]!
        return {
          cellData: {
            refName: cols[0],
            start,
            end,
            mateRefName: cols[3],
            mateStart,
            mateEnd,
            name: cols[6],
            score,
            strand: cols[8],
            mateStrand: cols[9],
            ...extra,
          },
          feature: {
            uniqueId: `bedpe-${idx}`,
            refName: cols[0]!,
            start,
            end,
            strand: parseStrand(cols[8]),
            mate: {
              refName: cols[3],
              start: mateStart,
              end: mateEnd,
              strand: parseStrand(cols[9]),
            },
            name: cols[6],
            score,
            ...extra,
          },
        }
      }),
    },
  }
}
