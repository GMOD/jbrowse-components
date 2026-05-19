import { bufferToLines, parseExtraColNames, parseExtraCols, parseStrand } from './util.ts'

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
    (rest[0]?.split('\t').length ?? 0) - coreColumns.length,
  )
  const extraNames = parseExtraColNames(lastHeaderLine, coreColumns.length, numExtraColumns)
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
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: cols[5],
            ...extra,
          },
          feature: {
            uniqueId: `bed-${idx}`,
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: parseStrand(cols[5]),
            ...extra,
          },
        }
      }),
    },
  }
}
