import { isNumber } from './isNumber.ts'
import { bufferToLines, parseStrand } from './util.ts'

// breakpoints look like `chr17:38243106:+` and the coordinate is 1-based, so
// convert to our interbase start
function parseSTARFusionBreakpointString(str: string) {
  const fields = str.split(':')
  const pos = +fields[1]!
  return {
    refName: fields[0]!,
    start: pos - 1,
    end: pos,
    strand: parseStrand(fields[2]),
  }
}

export function parseSTARFusionBuffer(buffer: Uint8Array) {
  const lines = bufferToLines(buffer)
  const header = lines[0]
  // the header is `#FusionName<TAB>...`, but the leading `#` is not universal
  // across STAR-Fusion versions and wrappers — slicing it off unconditionally
  // ate the first character of the first column's name
  const columns =
    (header?.startsWith('#') ? header.slice(1) : header)?.split('\t') ?? []
  if (!columns.length) {
    return { columns: [], rowSet: { rows: [] } }
  }
  // checked up front, and named. Every row builds its feature from these two,
  // so a file without them (the wrong file, or the right file with the wrong
  // File Type picked in the import form) used to fail on the first row with a
  // bare "Cannot read properties of undefined (reading 'split')" — which names
  // neither the column that is missing nor the guess that was wrong
  const missing = ['LeftBreakpoint', 'RightBreakpoint'].filter(
    c => !columns.includes(c),
  )
  if (missing.length) {
    throw new Error(
      `Not a STAR-Fusion file: no ${missing.join(' or ')} column. Found: ${columns.slice(0, 6).join(', ')}`,
    )
  }
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
            ...parseSTARFusionBreakpointString(row.LeftBreakpoint as string),
            mate: parseSTARFusionBreakpointString(
              row.RightBreakpoint as string,
            ),
          },
        }
      }),
    },
  }
}
