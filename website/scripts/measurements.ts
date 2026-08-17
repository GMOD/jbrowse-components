// A measurement is a RECORD, and the tables that show it are rendered from it.
//
// Every published figure in this repo used to begin as a number somebody typed
// into a markdown table by hand. `sync-measurements` made the website copy of
// that table generated, and `check-quoted-figures` checks the prose around it
// against the doc — but both of them start one hop too late. The hop that
// produces stale figures is the FIRST one, from a benchmark run to the table in
// `agent-docs/`, and nothing has ever gated it. The stale CRAM arena number came
// through there, and so did a `speedup` column whose divisions nobody re-did.
//
// So the source of truth is `agent-docs/measurements/<id>.json`: the values, the
// date they were taken, and the command that takes them again. The table in the
// doc is generated from it, the website's copy is generated from the doc, and
// prose can interpolate a cell instead of restating it.
//
// ## Why JSON and not the markdown table
//
// Three things the table cannot do:
//
// - **A derived column is computed.** `speedup` is `unpooled / pooled` and was
//   typed out five times; re-measure one arm and the ratio beside it silently
//   describes the old run. Same for `pif-coarse-tier-bytes`, where the last
//   column is `1 + coarse/fine`.
// - **Provenance is required.** `measured` and `source.repro` have no optional
//   spelling here, so a table cannot arrive without a date or a way to take it
//   again. Several of the migrated tables had their date only in the prose
//   above them, and two had none at all.
// - **A cell is addressable**, which is what lets prose say
//   `{{ synteny-pick-random.1-10k.warmPick }}` rather than repeating `12.5ms`
//   and drifting from the table directly above it.
//
// ## What it does not claim
//
// A record says what was measured and how to measure it again. It does not say
// the number is currently true — only re-running `source.repro` does that. What
// `source.kind` buys is that the gap is VISIBLE: `hand` means a human typed
// these values in and only a human can refresh them, and
// `pnpm measurement-tables` prints how many records are still in that state.
// The number should go down.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { walkFiles } from './check-utils.ts'
import { repoRoot } from './paths.ts'

export const measurementsDir = join(repoRoot, 'agent-docs/measurements')

/** How a cell's number is rendered. `text` passes a string through. */
export type Format =
  | 'text'
  | 'int'
  /** `143000` as `143k`, `36000` as `36K` — a magnitude, not an exact count. */
  | 'compact'
  /**
   * A bare fraction at its own precision, floored at two decimals: `0.30`
   * beside `0.005`. A fixed precision cannot carry both, and rounding the small
   * one to `0.01` doubles the figure the row exists to make.
   */
  | 'ratio'
  | 'ms'
  | 's'
  | 'x'
  | 'percent'
  | 'KB'
  | 'MB'
  | 'GB'

export interface Column {
  key: string
  label: string
  format?: Format
  /** Decimals. Defaults per format; `int` ignores it. */
  precision?: number
  /** The magnitude letter a `compact` column uses. Defaults to `k`. */
  suffix?: string
  /**
   * Let a size column step up a unit at 1000 — `1170` MB as `1.17 GB`.
   *
   * Opt-in, because the two kinds of size column want opposite things. A row
   * whose POINT is crossing a gigabyte should say so; a column showing a climb
   * (`303 MB`, `610 MB`, `1109 MB`) is read down its length and changing units
   * partway through hides the shape.
   */
  escalate?: boolean
  /** `---:` in the rendered delimiter row. */
  align?: 'left' | 'right'
  /**
   * An arithmetic expression over the other columns' keys, evaluated per row —
   * `"unpooledMs / pooledMs"`. A column with one takes no value in `rows`.
   */
  derived?: string
  /** Rendered for a row that has no value for this column. */
  absent?: string
}

export interface Row {
  values: Record<string, number | string | null>
  /** Column keys to render bold. Editorial, so it is data rather than a rule. */
  emphasize?: string[]
  /**
   * Override every column's format for this row.
   *
   * For a TRANSPOSED table, where the columns are the arms (`before`, `after`)
   * and each row is a different metric. There the unit belongs to the row —
   * `mount` is milliseconds and `DOM nodes` is a count — and without this the
   * table has to fall back to strings, which cannot be compared down a column
   * or referenced from prose.
   */
  format?: Format
  precision?: number
}

export interface Source {
  /**
   * `bench` — a script in this repo emits the values.
   * `jb2bench` — the sibling benchmark checkout owns them (`from` names its file).
   * `hand` — somebody typed them in. Refreshing means a human doing it again.
   */
  kind: 'bench' | 'jb2bench' | 'hand'
  /** The command that takes this measurement again. Required for all three. */
  repro: string
  /** For `jb2bench`, the path under that checkout the values came from. */
  from?: string
  /** Fixture, machine, build — whatever a re-run has to match. */
  notes?: string
}

export interface Measurement {
  id: string
  measured: string
  source: Source
  columns: Column[]
  rows: Row[]
  /**
   * Whether a public page is expected to publish this table. Defaults to true.
   *
   * `sync-measurements` treats an agent-doc table nothing publishes as an
   * error, on the reasoning that a table kept in step for no reader is a claim
   * nothing backs. Records make that reasoning conditional rather than wrong:
   * the doc's table is now generated whether a page consumes it or not, so a
   * measurement can legitimately be internal. Saying so here keeps the check
   * for every measurement that does not — the alternative is dropping it, and
   * then a page quietly losing its block reads exactly like this.
   */
  published?: boolean
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseMeasurement(id: string, text: string): Measurement {
  let raw: any
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new Error(`measurement ${id}: ${(e as Error).message}`, { cause: e })
  }
  const fail = (msg: string): never => {
    throw new Error(`measurement ${id}: ${msg}`)
  }
  if (raw.id !== id) {
    fail(`"id" is ${JSON.stringify(raw.id)} but the file is named ${id}.json`)
  }
  if (!ISO_DATE.test(raw.measured ?? '')) {
    fail('"measured" must be a YYYY-MM-DD date — when were these values taken?')
  }
  const source = raw.source
  if (!source || !['bench', 'jb2bench', 'hand'].includes(source.kind)) {
    fail('"source.kind" must be one of bench, jb2bench, hand')
  }
  if (!source.repro) {
    fail('"source.repro" must say how to take this measurement again')
  }
  if (source.kind === 'jb2bench' && !source.from) {
    fail('"source.from" must name the jb2bench file these values came from')
  }
  if (!Array.isArray(raw.columns) || raw.columns.length === 0) {
    fail('"columns" must be a non-empty array')
  }
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) {
    fail('"rows" must be a non-empty array')
  }
  // Validated as the untrusted shape it is, not as the interface it is about to
  // become: typing these as `Column`/`Row` first makes every check below look
  // redundant to the linter, which is exactly the reading that would delete
  // them.
  const keys = new Set<string>()
  for (const c of raw.columns as Partial<Column>[]) {
    // An EMPTY label is fine — the stub header over a table's row names — but
    // a missing one is a typo, and the two are different.
    if (!c.key || typeof c.label !== 'string') {
      fail(`every column needs a "key" and a "label" (see "${c.key ?? '?'}")`)
    }
    if (keys.has(c.key!)) {
      fail(`two columns share the key "${c.key}"`)
    }
    keys.add(c.key!)
  }
  for (const [i, row] of (raw.rows as Partial<Row>[]).entries()) {
    if (!row.values || typeof row.values !== 'object') {
      fail(`row ${i} has no "values"`)
    }
    for (const k of Object.keys(row.values)) {
      if (!keys.has(k)) {
        fail(`row ${i} sets "${k}", which is not a column`)
      }
    }
    for (const k of row.emphasize ?? []) {
      if (!keys.has(k)) {
        fail(`row ${i} emphasizes "${k}", which is not a column`)
      }
    }
  }
  return raw as Measurement
}

export function loadMeasurements(
  dir = measurementsDir,
): Map<string, Measurement> {
  const out = new Map<string, Measurement>()
  for (const file of walkFiles(dir, n => n.endsWith('.json'))) {
    const id = file
      .split('/')
      .pop()!
      .replace(/\.json$/, '')
    out.set(id, parseMeasurement(id, readFileSync(file, 'utf8')))
  }
  return out
}

// ## Derived columns
//
// A tiny arithmetic evaluator over the row's other columns, rather than
// `new Function`. Not a security argument — these files are as trusted as the
// code beside them — but a precedence-climbing parser is forty lines, and it
// gives a legible error for the mistake that actually happens: a typo'd column
// key, which `new Function` reports as `x is not defined` from inside a
// generated stack.
type Token = string

function tokenize(expr: string): Token[] {
  const out = expr.match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|[()+\-*/]/g)
  if (!out || out.join('') !== expr.replaceAll(/\s+/g, '')) {
    throw new Error(`cannot parse expression "${expr}"`)
  }
  return out
}

/** The column keys an expression reads. */
export function identifiers(expr: string): string[] {
  return tokenize(expr).filter(t => /^[A-Za-z_$]/.test(t))
}

/** Evaluate `expr` against a row's numeric columns. */
export function evaluate(expr: string, scope: Record<string, unknown>): number {
  const tokens = tokenize(expr)
  let at = 0
  const peek = () => tokens[at]
  const eat = (t: string) => {
    if (tokens[at] !== t) {
      throw new Error(`expected "${t}" in "${expr}"`)
    }
    at++
  }
  function primary(): number {
    const tok = peek()
    if (tok === undefined) {
      throw new Error(`unexpected end of "${expr}"`)
    }
    if (tok === '(') {
      eat('(')
      const v = additive()
      eat(')')
      return v
    }
    if (tok === '-') {
      eat('-')
      return -primary()
    }
    if (/^[+*/)]$/.test(tok)) {
      throw new Error(
        `cannot parse expression "${expr}": "${tok}" needs a value before it`,
      )
    }
    at++
    if (/^[\d.]/.test(tok)) {
      return Number(tok)
    }
    const v = scope[tok]
    if (typeof v !== 'number') {
      throw new Error(
        v === undefined
          ? `"${tok}" in "${expr}" is not a column of this measurement`
          : `"${tok}" in "${expr}" is ${JSON.stringify(v)}, not a number`,
      )
    }
    return v
  }
  function multiplicative(): number {
    let left = primary()
    for (;;) {
      const op = peek()
      if (op !== '*' && op !== '/') {
        return left
      }
      at++
      const right = primary()
      left = op === '*' ? left * right : left / right
    }
  }
  function additive(): number {
    let left = multiplicative()
    for (;;) {
      const op = peek()
      if (op !== '+' && op !== '-') {
        return left
      }
      at++
      const right = multiplicative()
      left = op === '+' ? left + right : left - right
    }
  }
  const value = additive()
  if (at !== tokens.length) {
    throw new Error(`trailing "${tokens.slice(at).join(' ')}" in "${expr}"`)
  }
  return value
}

// The FLOOR, not the precision. A measured value renders with at least this
// many decimals and as many more as the author wrote — `1.2ms` and `77ms` are
// one column, and `0.005` sits under `0.30`. Fixing the precision instead means
// either inventing digits nobody measured or rounding away the one the row was
// recorded for; both happened in the tables this replaced.
//
// A DERIVED value gets the floor exactly, since its decimals are an artifact of
// the division: `unpooledMs / pooledMs` is 1.4288..., and the column says 1.43x.
const DEFAULT_PRECISION: Partial<Record<Format, number>> = {
  x: 2,
  ratio: 2,
  percent: 0,
  ms: 0,
  s: 1,
  KB: 0,
  MB: 0,
  GB: 2,
}

const group = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const writtenDecimals = (value: number) =>
  (value.toString().split('.')[1] ?? '').length

/** A cell's rendered text — the one place a unit is spelled. */
export function formatValue(
  value: number | string,
  column: Column,
  { derived = false } = {},
): string {
  if (typeof value === 'string') {
    return value
  }
  const format = column.format ?? 'text'
  const floor = column.precision ?? DEFAULT_PRECISION[format] ?? 0
  const precision = derived ? floor : Math.max(floor, writtenDecimals(value))
  const fixed = value.toFixed(precision)
  switch (format) {
    case 'int': {
      return group(Math.round(value).toString())
    }
    case 'ms': {
      // Ungrouped. `2446ms` is one quantity and `2,446ms` reads as two, and the
      // docs this replaced all wrote it the first way.
      return `${fixed}ms`
    }
    case 's': {
      return `${fixed}s`
    }
    case 'x': {
      return `${fixed}x`
    }
    case 'percent': {
      return `${fixed}%`
    }
    case 'KB':
    case 'MB':
    case 'GB': {
      // Stops at GB. Nothing here measures a terabyte, and a unit ladder that
      // runs past what the corpus holds invites a row nobody can sanity-check.
      const up = { KB: 'MB', MB: 'GB' } as const
      if (format !== 'GB' && column.escalate && Math.abs(value) >= 1000) {
        return formatValue(
          value / 1000,
          { ...column, format: up[format], precision: undefined },
          { derived },
        )
      }
      return `${fixed} ${format}`
    }
    case 'ratio': {
      return fixed
    }
    case 'compact': {
      // `suffix` carries the case the doc already used — `299k` features but
      // `36 K` bytes — because normalizing it would rewrite two tables to say
      // something neither of them says.
      const suffix = column.suffix ?? 'k'
      if (Math.abs(value) < 1000) {
        return String(value)
      }
      const scaled = value / 1000
      const decimals =
        Math.abs(scaled) < 10 && !Number.isInteger(scaled) ? 1 : 0
      return `${scaled.toFixed(decimals)}${suffix}`
    }
    default: {
      return group(fixed)
    }
  }
}

/** Every column's value for one row, derived columns included. */
export function resolveRow(
  measurement: Measurement,
  row: Row,
): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = { ...row.values }
  for (const column of measurement.columns) {
    if (!column.derived) {
      continue
    }
    if (out[column.key] !== undefined) {
      throw new Error(
        `measurement ${measurement.id}: a row sets "${column.key}", which is derived from "${column.derived}"`,
      )
    }
    // A derived column over an absent input is absent, not NaN. Rows that opt
    // out of a measurement are the normal case here — `whole-genome` builds no
    // tree, so it has no pick time — and a `NaNx` in a published table is not.
    // Decided before evaluating rather than by catching: a missing input and a
    // typo'd column key raise the same error, and only one of them is fine.
    if (identifiers(column.derived).some(k => out[k] === null)) {
      out[column.key] = null
      continue
    }
    try {
      out[column.key] = evaluate(column.derived, out)
    } catch (e) {
      throw new Error(
        `measurement ${measurement.id}: ${(e as Error).message}`,
        { cause: e },
      )
    }
  }
  return out
}

// ## Referencing one value from prose
//
// `bgzf-pool-tabix.speedup.range`, `synteny-pick-random.1-10k.warmPickMs`.
// `sync-inline-figures` splices these into the docs; this resolves one.
//
// The failure they exist for is prose restating a cell from the table directly
// above it — "12.5ms is inside a 16ms frame", "203 KB gzipped and 166 chunks
// were reachable and never used". Both were true when written, neither moves
// when the table is regenerated, and `check-quoted-figures` cannot see it: the
// stale figure still occurs in a doc the page links, because it is still in
// last run's copy of the same number somewhere else.
const AGGREGATES = new Set(['min', 'max', 'span', 'range', 'first', 'last'])

function aggregate(
  measurement: Measurement,
  column: Column,
  kind: string,
): string {
  const values = measurement.rows
    .map(row => resolveRow(measurement, row)[column.key])
    .filter(v => typeof v === 'number')
  if (values.length === 0) {
    throw new Error(
      `${measurement.id}.${column.key} has no numeric values to take a ${kind} of`,
    )
  }
  const derived = !!column.derived
  const one = (v: number) => formatValue(v, column, { derived })
  const min = Math.min(...values)
  const max = Math.max(...values)
  switch (kind) {
    case 'min': {
      return one(min)
    }
    case 'max': {
      return one(max)
    }
    case 'first': {
      return one(values[0]!)
    }
    case 'last': {
      return one(values.at(-1)!)
    }
    case 'span': {
      return one(max - min)
    }
    default: {
      // One unit, shared, so the result parses as the single range
      // `check-quoted-figures` reads — `1.34-1.46x`, not `1.34x-1.46x`.
      const hi = one(max)
      const lo = one(min)
      const unit = hi.slice(hi.search(/[^\d,.]/))
      return `${lo.slice(0, lo.length - unit.length)}-${hi}`
    }
  }
}

/**
 * The rendered text for a `<id>.<…>` reference.
 *
 * Two shapes, told apart by whether the last segment names an aggregate:
 * `<id>.<column>.<min|max|span|range|first|last>` over a whole column, and
 * `<id>.<row>.<column>` for one cell.
 */
export function resolveReference(
  records: Map<string, Measurement>,
  ref: string,
): string {
  const [id, second, third] = ref.split('.')
  if (!id || !second || !third || ref.split('.').length !== 3) {
    throw new Error(
      `"${ref}" is not <id>.<row>.<column> or <id>.<column>.<aggregate>`,
    )
  }
  const measurement = records.get(id)
  if (!measurement) {
    throw new Error(`"${ref}" names no measurement "${id}"`)
  }
  const column = measurement.columns.find(c => c.key === third)
  if (AGGREGATES.has(third)) {
    const over = measurement.columns.find(c => c.key === second)
    if (!over) {
      throw new Error(`"${ref}": ${id} has no column "${second}"`)
    }
    return aggregate(measurement, over, third)
  }
  if (!column) {
    throw new Error(
      `"${ref}": ${id} has no column "${third}" (and "${third}" is not one of ${[...AGGREGATES].join(', ')})`,
    )
  }
  const row = measurement.rows.find(r => rowKey(measurement, r) === second)
  if (!row) {
    throw new Error(
      `"${ref}": ${id} has no row "${second}" — its rows are ${measurement.rows
        .map(r => rowKey(measurement, r))
        .join(', ')}`,
    )
  }
  const value = resolveRow(measurement, row)[column.key]
  if (value === null || value === undefined) {
    throw new Error(`"${ref}" is an absent cell — there is no figure to quote`)
  }
  const format = row.format ? { ...column, format: row.format } : column
  return formatValue(value, format, { derived: !!column.derived })
}

/** The row addressed by `key`: its first column's value, slugified. */
export function rowKey(measurement: Measurement, row: Row): string {
  const first = measurement.columns[0]!
  const raw = row.values[first.key]
  return String(raw ?? '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** The markdown table for a measurement, ready to splice into a doc. */
export function renderTable(measurement: Measurement): string[] {
  const headers = measurement.columns.map(c => c.label)
  const rows = measurement.rows.map(row => {
    const resolved = resolveRow(measurement, row)
    const emphasize = new Set(row.emphasize ?? [])
    const cells = measurement.columns.map(base => {
      const value = resolved[base.key]
      if (value === null || value === undefined) {
        return base.absent ?? '—'
      }
      const column = row.format
        ? { ...base, format: row.format, precision: row.precision }
        : base
      const text = formatValue(value, column, { derived: !!column.derived })
      return emphasize.has(column.key) ? `**${text}**` : text
    })
    return { cells }
  })
  // Padded to even columns, and not via `markdownTableLines`, which writes a
  // bare `---`. Both properties are the docs' own: several of these tables were
  // aligned by hand and a numeric column reads right-aligned, and a generator
  // that drops either makes the file it rewrites worse to read in the editor
  // where anybody checks a measurement.
  const cells = [headers, ...rows.map(r => r.cells)]
  const widths = measurement.columns.map((_, i) =>
    Math.max(...cells.map(row => row[i]!.length), 3),
  )
  const pad = (text: string, i: number) =>
    measurement.columns[i]!.align === 'right'
      ? text.padStart(widths[i]!)
      : text.padEnd(widths[i]!)
  const line = (row: string[]) =>
    `| ${row.map((c, i) => pad(c, i)).join(' | ')} |`
  const delimiters = measurement.columns.map((c, i) =>
    c.align === 'right'
      ? '-'.repeat(widths[i]! - 1) + ':'
      : '-'.repeat(widths[i]!),
  )
  return [
    line(headers),
    `| ${delimiters.join(' | ')} |`,
    ...rows.map(r => line(r.cells)),
  ]
}
