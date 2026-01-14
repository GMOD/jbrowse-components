import { isNumber } from './isNumber.ts'
import { bufferToLines, parseStrand } from './util.ts'

export function parseBedBuffer(buffer: Uint8Array) {
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
  const coreColumns = ['refName', 'start', 'end']
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
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: cols[5],
            ...Object.fromEntries(
              extraNames.map((n, idx) => {
                const r = cols[idx + coreColumns.length]
                return [n, isNumber(r) ? +r : r]
              }),
            ),
          },
          // an actual simplefeatureserialized
          feature: {
            uniqueId: `bed-${idx}`,
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: parseStrand(cols[5]),
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
