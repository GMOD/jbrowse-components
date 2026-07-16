import { IDENTITY_FIELDS, allFieldNames } from '../sourcesGridUtils.ts'

// Detect the primary delimiter from the first line (whichever of tab/comma
// appears first). Defaults to comma when neither is found.
function detectDelimiter(header: string): string {
  const ti = header.indexOf('\t')
  const ci = header.indexOf(',')
  if (ti === -1) {
    return ','
  }
  if (ci === -1) {
    return '\t'
  }
  return ti < ci ? '\t' : ','
}

// CSV parser for one line. Handles quoted fields containing the delimiter and
// "" as an escaped quote; a newline inside a quoted field is not (callers split
// on newlines first). Falls back to a plain split when no quotes are present.
function parseCSVRow(line: string, delim: string): string[] {
  if (!line.includes('"')) {
    return line.split(delim)
  }
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let field = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"'
          i += 2
        } else if (line[i] === '"') {
          i++ // skip closing quote
          break
        } else {
          field += line[i++]
        }
      }
      fields.push(field)
      if (i < line.length && line[i] === delim) {
        i++
      }
    } else {
      const start = i
      while (i < line.length && line[i] !== delim) {
        i++
      }
      fields.push(line.slice(start, i))
      if (i < line.length) {
        i++
      }
    }
  }
  return fields
}

const nonEmptyLines = (val: string) =>
  val
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

const zipRecord = (fields: string[], cols: string[]) =>
  Object.fromEntries(fields.map((f, i) => [f, cols[i] ?? '']))

// Parse CSV/TSV with a header row that includes a `name` column for join.
export function parseRowsByName(
  val: string,
): Record<string, Record<string, string>> {
  const lines = nonEmptyLines(val)
  const header = lines[0]
  if (!header) {
    throw new Error('Nothing pasted: expected a header row plus data rows')
  }
  const delim = detectDelimiter(header)
  const fields = parseCSVRow(header, delim)
  const nameIdx = fields.indexOf('name')
  if (nameIdx === -1) {
    throw new Error('No "name" column found on line 1')
  }
  return Object.fromEntries(
    lines.slice(1).flatMap(line => {
      const cols = parseCSVRow(line, delim)
      const name = cols[nameIdx]
      return name ? [[name, zipRecord(fields, cols)]] : []
    }),
  )
}

// An empty cell means "unset this field", not "set it to the empty string".
// Consumers synthesize defaults with `??` (e.g. multi-wiggle's overlay color
// palette in sourcesLogic.ts), which a '' would satisfy and thereby defeat —
// round-tripping "Copy current as CSV" through Update rows would otherwise turn
// every unset color into a set-but-blank one and collapse the palette.
function unsetBlanks(patch: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [k, v === '' ? undefined : v]),
  )
}

// Join parsed rows (by name) onto the current layout.
// - Rows whose name is not in the paste are always kept unchanged.
// - replace=false: patch pasted fields over existing fields.
// - replace=true: for matched rows, start from {} so only pasted fields
//   survive. Identity fields omitted from the paste (e.g. `source`, `baseUri`)
//   drop out here but are restored by `reconcileLayout`, which merges each
//   layout entry onto its discovered row — the layout is a partial override,
//   never the whole record.
export function mergeParsedRows<S extends { name: string }>(
  currLayout: S[],
  byName: Record<string, Record<string, string>>,
  replace: boolean,
): S[] {
  return currLayout.map(record => {
    const patch = byName[record.name]
    if (!patch) {
      return record
    }
    return {
      ...(replace ? {} : record),
      ...unsetBlanks(patch),
      name: record.name,
    } as S
  })
}

// Names present in the paste but absent from the current layout.
export function unmatchedNames(
  currLayout: { name: string }[],
  byName: Record<string, Record<string, string>>,
): string[] {
  const known = new Set(currLayout.map(r => r.name))
  return Object.keys(byName).filter(n => !known.has(n))
}

// Serialize a field value as a CSV cell, quoting when needed.
function toCsvField(val: string): string {
  return /[,\t\n"]/.test(val) ? `"${val.replaceAll('"', '""')}"` : val
}

// Field names to include in an export: every field the rows can carry, minus
// the identity fields, with `name` always first. `source`/`baseUri` are dropped
// because `source` always equals `name` for multi-wiggle and `baseUri` is
// plumbing.
//
// Deliberately the shape (allFieldNames), not the populated columns
// (extraColumns): exporting a still-empty field is how the user discovers it is
// settable, and round-tripping the export must not silently narrow the header.
function csvExportFields(rows: Record<string, unknown>[]): string[] {
  return ['name', ...allFieldNames(rows, new Set<string>(IDENTITY_FIELDS))]
}

// Serialize the current layout as a CSV string suitable for pasting back.
export function toCSV(rows: Record<string, unknown>[]): string {
  const fields = csvExportFields(rows)
  return [
    fields.join(','),
    ...rows.map(row =>
      fields.map(f => toCsvField(String(row[f] ?? ''))).join(','),
    ),
  ].join('\n')
}
