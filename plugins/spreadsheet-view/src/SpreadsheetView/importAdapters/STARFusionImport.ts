import { parseStrand } from './util'

function parseSTARFusionBreakpointString(str: string) {
  const fields = str.split(':')
  return {
    refName: fields[0],
    start: +fields[1]!,
    end: +fields[1]! + 1,
    strand: parseStrand(fields[2]),
  }
}

export function parseSTARFusionBuffer(buffer: Uint8Array) {
  const text = new TextDecoder('utf8').decode(buffer)
  const lines = text
    .split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(f => !!f)
  const columns = lines[0]!.slice(1).split('\t')
  const data = lines.slice(1).map(line => {
    const cols = line.split('\t')
    return Object.fromEntries(columns.map((h, i) => [h, cols[i]]))
  })

  return {
    columns: columns.map(c => ({
      name: c,
    })),
    rowSet: {
      rows: data.map((row, rowNumber) => ({
        cellData: row,
        feature: {
          uniqueId: `sf-${rowNumber}`,
          ...parseSTARFusionBreakpointString(row.LeftBreakpoint!),
          mate: parseSTARFusionBreakpointString(row.RightBreakpoint!),
        },
      })),
    },
  }
}
