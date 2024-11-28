import { bufferToLines, parseStrand } from './util'

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
  const lines = bufferToLines(buffer)
  const columns = lines[0]!.slice(1).split('\t')
  return {
    columns: columns.map(c => ({ name: c })),
    rowSet: {
      rows: lines
        .slice(1)
        .map(line => {
          const cols = line.split('\t')
          return Object.fromEntries(columns.map((h, i) => [h, cols[i]]))
        })
        .map((row, rowNumber) => ({
          // what is displayed
          cellData: row,
          // an actual simplefeatureserialized
          feature: {
            uniqueId: `sf-${rowNumber}`,
            ...parseSTARFusionBreakpointString(row.LeftBreakpoint!),
            mate: parseSTARFusionBreakpointString(row.RightBreakpoint!),
          },
        })),
    },
  }
}
