export function parseBedBuffer(buffer: Uint8Array) {
  const data = new TextDecoder('utf8').decode(buffer)
  const lines = data
    .split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(f => !!f)
  const rest = lines.filter(
    line =>
      !(
        line.startsWith('#') ||
        line.startsWith('browser') ||
        line.startsWith('track')
      ),
  )

  const lastHeaderLine = lines.findLast(line => line.startsWith('#'))
  const coreColumns = ['refName', 'start', 'end', 'name', 'score', 'strand']
  const numExtraColumns = Math.max(
    0,
    (rest[0]?.split('\t')?.length || 0) - coreColumns.length,
  )
  const extraNames = lastHeaderLine?.includes('\t')
    ? lastHeaderLine.slice(1).split('\t').slice(coreColumns.length)
    : Array.from({ length: numExtraColumns }, (_v, i) => `field_${i}`)

  const colNames = [...coreColumns, ...extraNames]

  return {
    columns: colNames.map(c => ({ name: c })),
    rowSet: {
      rows: rest.map((line, idx) => {
        const cols = line.split('\t')
        return {
          cellData: {
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: cols[5],
            ...Object.fromEntries(
              extraNames.map((n, idx) => [n, cols[idx + coreColumns.length]]),
            ),
          },
          feature: {
            uniqueId: `bed-${idx}`,
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: cols[5],
            ...Object.fromEntries(
              extraNames.map((n, idx) => [n, cols[idx + coreColumns.length]]),
            ),
          },
        }
      }),
    },
  }
}
