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
