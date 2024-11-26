import type { Buffer } from 'buffer'

export function parseBedPEBuffer(buffer: Buffer) {
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
    columns: [
      'refName',
      'start',
      'end',
      'mateStart',
      'mateEnd',
      'name',
      'score',
      'strand',
      'mateStrand',
    ].map(c => ({
      name: c,
    })),
    rowSet: {
      rows: rest.map((line, idx) => {
        const cols = line.split('\t')
        return {
          cellData: {
            refName: cols[0],
            start: cols[1],
            end: cols[2],
            mateRefName: cols[3],
            mateStart: cols[4],
            mateEnd: cols[5],
            name: cols[6],
            score: cols[7],
            strand: cols[8],
            mateStrand: cols[9],
          },
          feature: {
            uniqueId: `bedpe-${idx}`,
            refName: cols[0],
            start: +cols[1]!,
            end: +cols[2]!,
            strand: cols[8],
            mate: {
              refName: cols[3],
              start: +cols[4]!,
              end: +cols[5]!,
              strand: cols[9],
            },
            name: cols[6],
            score: cols[7],
          },
        }
      }),
    },
  }
}
