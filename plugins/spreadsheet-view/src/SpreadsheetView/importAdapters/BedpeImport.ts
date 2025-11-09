import { isNumber } from '@mui/x-data-grid/internals'

import { bufferToLines, parseStrand } from './util'

export function parseBedPEBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  const rest = lines.filter(
    line =>
      !(
        line.startsWith('#') ||
        line.startsWith('browser') ||
        line.startsWith('track')
      ),
  )
  const lastHeaderLine = lines.findLast(line => line.startsWith('#'))

  const coreColumns = [
    'refName',
    'start',
    'end',
    'mateRef',
    'mateStart',
    'mateEnd',
    'name',
    'score',
    'strand',
    'mateStrand',
  ]
  const numExtraColumns = Math.max(
    0,
    (rest[0]?.split('\t').length || 0) - coreColumns.length,
  )

  const extraNames = lastHeaderLine?.includes('\t')
    ? lastHeaderLine
        .slice(1)
        .split('\t')
        .slice(coreColumns.length)
        .map(t => t.trim())
    : Array.from({ length: numExtraColumns }, (_v, i) => `field_${i}`)

  const colNames = [...coreColumns, ...extraNames]
  return {
    columns: colNames.map(c => ({ name: c })),
    rowSet: {
      rows: rest.map((line, idx) => {
        const cols = line.split('\t')

        return {
          // what is displayed
          cellData: {
            refName: cols[0],
            start: cols[1],
            end: cols[2],
            mateRefName: cols[3],
            mateStart: cols[4],
            mateEnd: cols[5],
            name: cols[6],
            score: +cols[7]! || cols[7],
            strand: cols[8],
            mateStrand: cols[9],
            ...Object.fromEntries(
              extraNames.map((n, idx) => {
                const r = cols[idx + coreColumns.length]
                return [n, isNumber(r) ? +r : r]
              }),
            ),
          },
          // an actual simplefeatureserialized
          feature: {
            uniqueId: `bedpe-${idx}`,
            refName: cols[0],
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
            ...Object.fromEntries(
              extraNames.map((n, idx) => {
                const r = cols[idx + coreColumns.length]
                return [n, isNumber(r) ? +r : r]
              }),
            ),
          },
        }
      }),
    },
  }
}
