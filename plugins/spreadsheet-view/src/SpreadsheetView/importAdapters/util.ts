import { isNumber } from './isNumber.ts'

function parseExtraColNames(
  lastHeaderLine: string | undefined,
  coreColCount: number,
  numExtraColumns: number,
) {
  // field_N names whatever the header leaves unnamed: a leading provenance
  // comment can pass for a header that names none
  const named =
    lastHeaderLine
      ?.slice(1)
      .split('\t')
      .slice(coreColCount)
      .map(t => t.trim()) ?? []
  return Array.from(
    { length: Math.max(numExtraColumns, named.length) },
    (_v, i) => named[i] || `field_${i}`,
  )
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

// unstranded is undefined here and 0 in plugin-bed's helper; every consumer
// reads `strand ?? 0`
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

// whole words, so a `track1` contig is data
const BED_DIRECTIVE_REGEXP = /^(?:browser|track)(?:\s|$)/

function isBedHeaderLine(line: string) {
  return line.startsWith('#') || BED_DIRECTIVE_REGEXP.test(line)
}

export function filterBedHeaderLines(lines: string[]) {
  return lines.filter(line => !isBedHeaderLine(line))
}

// a BED-like file's data lines and columns, extras named by its last leading
// `#` line
export function computeBedColumns(lines: string[], coreColumns: string[]) {
  const rest = filterBedHeaderLines(lines)
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
