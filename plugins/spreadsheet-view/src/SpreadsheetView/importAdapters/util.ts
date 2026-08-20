import { isNumber } from './isNumber.ts'

function parseExtraColNames(
  lastHeaderLine: string | undefined,
  coreColCount: number,
  numExtraColumns: number,
) {
  // The header names as many of the extra columns as it names, and the field_N
  // fallback covers whatever it leaves. It used to decide the list outright, so
  // any column past the header's last name vanished from the sheet — from the
  // column list and from every row's cellData alike, with nothing to say so.
  //
  // A header that undercounts is not the exotic case it sounds like: the header
  // is "the last `#` line before the data", and a leading `# produced by\tfoo`
  // provenance comment is indistinguishable from a real one. That names zero
  // extras, which used to throw away every extra column in the file.
  const named =
    lastHeaderLine
      ?.slice(1)
      .split('\t')
      .slice(coreColCount)
      .map(t => t.trim()) ?? []
  // still the first data row's width when the header names fewer, but never
  // fewer than the header names: a ragged file can have more columns further
  // down than its first row does
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

// `.`/absent is undefined here where plugin-bed's same-named helper answers 0,
// and the two are interchangeable downstream — these features are
// SimpleFeatureSerialized snapshots and every consumer of one reads
// `strand ?? 0`. So a shared helper would only have to pick one of the two
// unstranded values for both. maf's third copy answers +1, because a MAF row
// has no unstranded case to encode.
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

// `browser position ...` and `track name=...` are whole words in the UCSC spec.
// Matching them as bare prefixes also swallowed any data line whose refName
// merely began with one — a `track1` or `browserScaffold` contig was dropped
// from the sheet as if it were a header
const BED_DIRECTIVE_REGEXP = /^(?:browser|track)(?:\s|$)/

function isBedHeaderLine(line: string) {
  return line.startsWith('#') || BED_DIRECTIVE_REGEXP.test(line)
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
