import { isNumber } from './isNumber.ts'

export function parseExtraColNames(
  lastHeaderLine: string | undefined,
  coreColCount: number,
  numExtraColumns: number,
) {
  return lastHeaderLine?.includes('\t')
    ? lastHeaderLine
        .slice(1)
        .split('\t')
        .slice(coreColCount)
        .map(t => t.trim())
    : Array.from({ length: numExtraColumns }, (_v, i) => `field_${i}`)
}

export function parseExtraCols(
  cols: string[],
  extraNames: string[],
  coreColCount: number,
) {
  return Object.fromEntries(
    extraNames.map((n, i) => {
      const r = cols[i + coreColCount]
      return [n, isNumber(r) ? +r : r]
    }),
  )
}

export function parseStrand(strand?: string) {
  return strand === '+' ? 1 : strand === '-' ? -1 : undefined
}

export function bufferToLines(buffer: Uint8Array) {
  return new TextDecoder('utf8')
    .decode(buffer)
    .split(/\n|\r\n|\r/)
    .map(f => f.trim())
    .filter(f => f !== '')
}

function isBedHeaderLine(line: string) {
  return (
    line.startsWith('#') ||
    line.startsWith('browser') ||
    line.startsWith('track')
  )
}

export function filterBedHeaderLines(lines: string[]) {
  return lines.filter(line => !isBedHeaderLine(line))
}

// shared scaffolding for BED-like formats: strips header lines, derives the
// extra-column names (from the last `#` header line, or field_N as a fallback),
// and returns the data lines plus the resolved column list
export function computeBedColumns(lines: string[], coreColumns: string[]) {
  const rest = filterBedHeaderLines(lines)
  // the column-name header is the last `#` line of the leading header block; a
  // `#` comment further down the file is a comment, not the header
  const firstDataLine = lines.findIndex(line => !isBedHeaderLine(line))
  const lastHeaderLine = lines
    .slice(0, firstDataLine === -1 ? lines.length : firstDataLine)
    .findLast(line => line.startsWith('#'))
  const numExtraColumns = Math.max(
    0,
    (rest[0]?.split('\t').length ?? 0) - coreColumns.length,
  )
  const extraNames = parseExtraColNames(
    lastHeaderLine,
    coreColumns.length,
    numExtraColumns,
  )
  return {
    rest,
    extraNames,
    columns: [...coreColumns, ...extraNames].map(name => ({ name })),
  }
}
