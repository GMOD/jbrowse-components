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

export function filterBedHeaderLines(lines: string[]) {
  return lines.filter(
    line =>
      !line.startsWith('#') &&
      !line.startsWith('browser') &&
      !line.startsWith('track'),
  )
}

// shared scaffolding for BED-like formats: strips header lines, derives the
// extra-column names (from the last `#` header line, or field_N as a fallback),
// and returns the data lines plus the resolved column list
export function computeBedColumns(lines: string[], coreColumns: string[]) {
  const rest = filterBedHeaderLines(lines)
  const lastHeaderLine = lines.findLast(line => line.startsWith('#'))
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
