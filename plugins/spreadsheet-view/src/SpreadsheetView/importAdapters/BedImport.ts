import type { Buffer } from 'buffer'

export function parseBedBuffer(buffer: Buffer) {
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

  return {
    columns: ['refName', 'start', 'end', 'name', 'score', 'strand'].map(c => ({
      name: c,
    })),
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
          },
          feature: {
            uniqueId: `bed-${idx}`,
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            name: cols[3],
            score: cols[4],
            strand: cols[5],
          },
        }
      }),
    },
  }
}
