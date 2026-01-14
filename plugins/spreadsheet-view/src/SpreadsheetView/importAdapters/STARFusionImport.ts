import { isNumber } from './isNumber.ts'
import { bufferToLines, parseStrand } from './util.ts'

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
      rows: lines.slice(1).map((line, rowNumber) => {
        const cols = line.split('\t')
        const row = Object.fromEntries(
          columns.map((h, i) => [h, isNumber(cols[i]) ? +cols[i] : cols[i]!]),
        )
        return {
          // what is displayed
          cellData: row,
          // an actual simplefeatureserialized
          feature: {
            uniqueId: `sf-${rowNumber}`,
            ...parseSTARFusionBreakpointString(row.LeftBreakpoint! as string),
            mate: parseSTARFusionBreakpointString(
              row.RightBreakpoint! as string,
            ),
          },
        }
      }),
    },
  }
}
