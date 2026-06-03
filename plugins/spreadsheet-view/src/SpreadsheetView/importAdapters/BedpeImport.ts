import { isNumber } from './isNumber.ts'
import {
  bufferToLines,
  filterBedHeaderLines,
  parseExtraColNames,
  parseExtraCols,
  parseStrand,
} from './util.ts'

export function parseBedPEBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  const rest = filterBedHeaderLines(lines)
  const lastHeaderLine = lines.findLast(line => line.startsWith('#'))

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
  const numExtraColumns = Math.max(
    0,
    (rest[0]?.split('\t').length ?? 0) - coreColumns.length,
  )
  const extraNames = parseExtraColNames(
    lastHeaderLine,
    coreColumns.length,
    numExtraColumns,
  )
  const colNames = [...coreColumns, ...extraNames]

  return {
    columns: colNames.map(c => ({ name: c })),
    rowSet: {
      rows: rest.map((line, idx) => {
        const cols = line.split('\t')
        const extra = parseExtraCols(cols, extraNames, coreColumns.length)
        return {
          cellData: {
            refName: cols[0],
            start: cols[1],
            end: cols[2],
            mateRefName: cols[3],
            mateStart: cols[4],
            mateEnd: cols[5],
            name: cols[6],
            score: isNumber(cols[7]) ? +cols[7] : cols[7],
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
            score: cols[7],
            ...extra,
          },
        }
      }),
    },
  }
}
