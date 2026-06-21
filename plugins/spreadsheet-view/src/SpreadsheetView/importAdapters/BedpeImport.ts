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
        return {
          cellData: {
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            mateRefName: cols[3],
            mateStart: +cols[4]!,
            mateEnd: +cols[5]!,
            name: cols[6],
            score,
            strand: cols[8],
            mateStrand: cols[9],
            ...extra,
          },
          feature: {
            uniqueId: `bedpe-${idx}`,
            refName: cols[0]!,
            start: +cols[1]!,
            end: +cols[2]!,
            strand: parseStrand(cols[8]),
            mate: {
              refName: cols[3],
              start: +cols[4]!,
              end: +cols[5]!,
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
