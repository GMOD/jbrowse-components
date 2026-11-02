import { rowFieldValue } from '../rowColorScale.ts'
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
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim() !== '')

const zipRecord = (fields: string[], cols: string[]) =>
  Object.fromEntries(fields.map((f, i) => [f, cols[i] ?? '']))

// The paste, joined by row name. A `Map`, not a `Record`, because the keys are
// row names — arbitrary strings out of somebody's data file — and a plain
// object answers for every key `Object.prototype` has. `byName[row.name]` on a
// row named `constructor`, `toString` or `valueOf` came back with an inherited
// function instead of `undefined`, so `mergeParsedRows` treated the row as
// matched by a paste that never mentioned it; under "Replace rows" that meant
// starting from `{}` and spreading nothing over it, i.e. silently dropping
// every field the row had. Same reason `ClusterMatrix` is a Map.
export type ParsedRows = Map<string, Record<string, string>>

// Parse CSV/TSV with a header row that includes a `name` column for join.
export function parseRowsByName(val: string): ParsedRows {
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
  return new Map(
    lines.slice(1).flatMap(line => {
      const cols = parseCSVRow(line, delim)
      const name = cols[nameIdx]
      return name
        ? ([[name, zipRecord(fields, cols)]] as [
            string,
            Record<string, string>,
          ][])
        : []
    }),
  )
}

/** The fields a paste sets, since they are what the dialog's Submit writes. */
export const BULK_EDIT_FIELDS: readonly string[] = ['label', 'rowColor']

/**
 * The dialog's rows with the paste's `BULK_EDIT_FIELDS` joined on by name, a
 * blank cell unsetting its field. A row the paste does not name is kept
 * unchanged; `replace` also unsets a field the paste has no column for.
 */
export function mergeParsedRows<S extends { name: string }>(
  currLayout: S[],
  byName: ParsedRows,
  replace: boolean,
): S[] {
  return currLayout.map(record => {
    const patch = byName.get(record.name)
    if (!patch) {
      return record
    }
    const next: Record<string, unknown> = { ...record }
    for (const field of BULK_EDIT_FIELDS) {
      if (Object.hasOwn(patch, field)) {
        next[field] = patch[field] || undefined
      } else if (replace) {
        next[field] = undefined
      }
    }
    return next as S
  })
}

/**
 * The pasted columns outside `BULK_EDIT_FIELDS` holding a value that differs
 * from a matched row's, which a paste does not apply.
 */
export function ignoredColumns(
  currLayout: readonly { name: string }[],
  byName: ParsedRows,
): string[] {
  const rows = new Map(currLayout.map(row => [row.name, row]))
  const ignored = new Set<string>()
  for (const [name, patch] of byName) {
    const row = rows.get(name)
    if (row) {
      for (const [field, value] of Object.entries(patch)) {
        if (
          field !== 'name' &&
          !BULK_EDIT_FIELDS.includes(field) &&
          value !== rowFieldValue(row, field)
        ) {
          ignored.add(field)
        }
      }
    }
  }
  return [...ignored]
}

// Names present in the paste but absent from the current layout.
export function unmatchedNames(
  currLayout: { name: string }[],
  byName: ParsedRows,
): string[] {
  const known = new Set(currLayout.map(r => r.name))
  return [...byName.keys()].filter(n => !known.has(n))
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
