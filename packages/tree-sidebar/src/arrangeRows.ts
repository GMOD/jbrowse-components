import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

import type { RowSource } from './types.ts'

/**
 * Where the rows an order does not list go: `source` keeps the order they
 * arrived in, `sorted` sorts them the way every in-track grouping sorts.
 */
export type UnlistedRowsSort = 'source' | 'sorted'

/**
 * The name a row also answers to — a haplotype row's sample, and a sample
 * row's own name — or undefined for a name no current row answers to.
 */
export type RowAlias = (name: string) => string | undefined

/**
 * The row a row refines, by name, as a haplotype row refines its sample, and
 * what the row's label adds to that row's label (` HP1`); `''` where the row
 * stands for it alone, as a haploid sample's one row.
 */
export interface RowParent {
  name: string
  labelSuffix: string
}

/** A display's row-parent hook: undefined for a row that refines none. */
export type RowParentOf<S> = (row: S) => RowParent | undefined

export interface RowArrangementInput {
  domain: readonly string[]
  labels: Readonly<Record<string, string>>
}

export interface ArrangeRowsHooks<S> {
  readonly unlistedRowsSort: UnlistedRowsSort
  readonly rowAlias: RowAlias | undefined
  rowParent(row: S): RowParent | undefined
}

export function otherName(alias: RowAlias, name: string) {
  const other = alias(name)
  return other === name ? undefined : other
}

/**
 * The names `rows` answer to, read off each row's parent (`parentOf`), never
 * parsed from its name: a row answers to its own name, a refining row to its
 * parent's, and a parent no row draws to itself. `finer` holds the rows a
 * finer field would draw, each answering to the drawn row it refines, so an
 * entry naming one reaches that row; a drawn row's own name wins over it.
 * Undefined where no row refines another.
 */
export function rowAliasOver<S extends { name: string }>(
  rows: readonly S[],
  finer: readonly S[],
  parentOf: RowParentOf<S>,
): RowAlias | undefined {
  const answers = new Map<string, string>()
  const parents: string[] = []
  for (const row of rows) {
    const parent = parentOf(row)?.name
    answers.set(row.name, parent ?? row.name)
    if (parent !== undefined) {
      parents.push(parent)
    }
  }
  for (const parent of parents) {
    if (!answers.has(parent)) {
      answers.set(parent, parent)
    }
  }
  let refining = parents.length > 0
  for (const row of finer) {
    const parent = parentOf(row)?.name
    if (parent !== undefined && !answers.has(row.name)) {
      answers.set(row.name, parent)
      refining = true
    }
  }
  return refining ? name => answers.get(name) : undefined
}

/**
 * A row's label where `labels` names it or its parent: its own entry exactly,
 * else its parent's entry with what the row adds (`Mother HP1`). Own-property
 * reads, since row names come from files and a row called `constructor` would
 * otherwise read one off `Object.prototype`.
 */
export function inheritedLabel(
  labels: Readonly<Record<string, string>>,
  name: string,
  parent: RowParent | undefined,
) {
  return Object.hasOwn(labels, name)
    ? labels[name]
    : parent !== undefined && Object.hasOwn(labels, parent.name)
      ? `${labels[parent.name]}${parent.labelSuffix}`
      : undefined
}

function sortedRows<S extends RowSource>(rows: S[], domain: readonly string[]) {
  const compare = groupKeyComparator(domain)
  for (let i = 1; i < rows.length; i++) {
    if (compare(rows[i - 1]!.name, rows[i]!.name) > 0) {
      return [...rows].sort((a, b) => compare(a.name, b.name))
    }
  }
  return rows
}

// The earliest index of a domain entry no row draws that `alias` maps onto a
// drawn row, by that row: a sample ranks at its first haplotype entry
function collapsedRanks(
  rows: readonly { name: string }[],
  domain: readonly string[],
  alias: RowAlias,
) {
  const drawn = new Set(rows.map(row => row.name))
  const ranks = new Map<string, number>()
  for (let i = 0; i < domain.length; i++) {
    const name = domain[i]!
    const onto = drawn.has(name) ? undefined : alias(name)
    if (
      onto !== undefined &&
      onto !== name &&
      drawn.has(onto) &&
      !ranks.has(onto)
    ) {
      ranks.set(onto, i)
    }
  }
  return ranks
}

function earliest(...ranks: (number | undefined)[]) {
  let min: number | undefined
  for (const rank of ranks) {
    if (rank !== undefined && (min === undefined || rank < min)) {
      min = rank
    }
  }
  return min
}

function orderByRank<S extends { name: string }>(
  rows: S[],
  domain: readonly string[],
  alias: RowAlias | undefined,
): S[] {
  if (!domain.length) {
    return rows
  }
  const rank = new Map<string, number>()
  for (let i = 0; i < domain.length; i++) {
    if (!rank.has(domain[i]!)) {
      rank.set(domain[i]!, i)
    }
  }
  const collapsed = alias ? collapsedRanks(rows, domain, alias) : undefined
  const ranks = new Int32Array(rows.length).fill(-1)
  const starts = new Int32Array(domain.length + 1)
  let listed = 0
  for (let i = 0; i < rows.length; i++) {
    const { name } = rows[i]!
    const other = alias ? otherName(alias, name) : undefined
    const r = earliest(
      rank.get(name),
      other === undefined ? undefined : rank.get(other),
      collapsed?.get(name),
    )
    if (r !== undefined) {
      ranks[i] = r
      starts[r + 1]! += 1
      listed++
    }
  }
  if (!listed) {
    return rows
  }
  for (let r = 1; r < starts.length; r++) {
    starts[r]! += starts[r - 1]!
  }
  const ordered = new Array<S>(rows.length)
  let unlisted = listed
  let moved = false
  for (let i = 0; i < rows.length; i++) {
    const r = ranks[i]!
    const at = r < 0 ? unlisted++ : starts[r]!++
    ordered[at] = rows[i]!
    moved ||= at !== i
  }
  return moved ? ordered : rows
}

function relabelRows<S extends RowSource>(
  rows: S[],
  labels: Readonly<Record<string, string>>,
  rowParent: RowParentOf<S>,
) {
  let out: S[] | undefined
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const label = inheritedLabel(labels, row.name, rowParent(row))
    if (label !== undefined && label !== row.label) {
      out ??= [...rows]
      out[i] = { ...row, label }
    }
  }
  return out ?? rows
}

/**
 * The rows `domain` names first, in its order, and every other row in the
 * order it arrived in: the adapter's for a quantitative display, the file's
 * sample order for the variant displays. A name matching no row places
 * nothing, and a name listed twice places its row once. With `rowAlias`, a
 * row the domain does not name takes its alias's place, beside the other rows
 * answering to it in the order they came in.
 *
 * **This is the no-tree half.** Where a tree describes the rows, the domain is
 * a preference the topology honours rather than a placement: the tree is
 * rotated towards it (`rotateNewickByDomain`) and the rows follow its leaves,
 * so the dendrogram keeps drawing. MAF passes those leaf names ahead of the
 * domain, which is how one function states both halves.
 *
 * Returns `rows` by reference when the domain moves nothing, so callers can
 * short-circuit on identity.
 */
export function orderRowsByDomain<S extends { name: string }>(
  rows: S[],
  domain: readonly string[],
  rowAlias?: RowAlias,
): S[] {
  return orderByRank(rows, domain, rowAlias)
}

/** A band of the rows as drawn: its value, its label and the rows it spans. */
export interface RowBand {
  key: string
  label: string
  start: number
  /** exclusive, so `end - start` is the band's row count */
  end: number
}

/** What bands a display's rows: the attribute read and the bands listed first. */
export interface RowBanding {
  field: string
  sort: readonly string[]
}

/**
 * The rows stacked by band, each band's rows in the order they arrived in,
 * the bands in `domain` order and the rest sorted with the `''` band last,
 * and the span each band takes. No bands, and `rows` itself, while no row
 * carries a band value; `rows` itself too while the bands already stack.
 */
export function bandRows<S>(
  rows: S[],
  bandOf: (row: S) => string,
  banding: RowBanding,
): { rows: S[]; bands: RowBand[] } {
  const keys = rows.map(bandOf)
  if (!keys.some(key => key !== '')) {
    return { rows, bands: [] }
  }
  const counts = new Map<string, number>()
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const ordered = [...counts.keys()].sort(groupKeyComparator(banding.sort))
  const starts = new Map<string, number>()
  const bands: RowBand[] = []
  let at = 0
  for (const key of ordered) {
    const end = at + counts.get(key)!
    starts.set(key, at)
    bands.push({
      key,
      label: key === '' ? `(no ${banding.field})` : key,
      start: at,
      end,
    })
    at = end
  }
  const out = new Array<S>(rows.length)
  let moved = false
  for (let i = 0; i < rows.length; i++) {
    const slot = starts.get(keys[i]!)!
    starts.set(keys[i]!, slot + 1)
    out[slot] = rows[i]!
    moved ||= slot !== i
  }
  return { rows: moved ? out : rows, bands }
}

/**
 * The rows in a reader's arrangement: the rows `domain` lists lead, in its
 * order, and the rest follow as `unlistedRowsSort` says. A row ranks at the
 * earlier of its own entry and its parent's (`rowAlias`), and a drawn row at
 * the earliest entry naming a finer row that refines it, so the latest order
 * written at either field wins. A `labels` entry of a row's own is its label
 * exactly; else its parent's entry composes with what the row adds
 * (`rowParent`), so a label written against a sample reaches each of its
 * haplotypes as `Mother HP1`.
 *
 * Hands back `rows` itself whenever nothing moves or changes, so a consumer
 * keyed on identity sees no change.
 */
export function arrangeRows<S extends RowSource>(
  rows: S[],
  { domain, labels }: RowArrangementInput,
  hooks: ArrangeRowsHooks<S>,
): S[] {
  const relabelled =
    Object.keys(labels).length > 0
      ? relabelRows(rows, labels, row => hooks.rowParent(row))
      : rows
  return hooks.unlistedRowsSort === 'sorted'
    ? sortedRows(relabelled, domain)
    : orderByRank(relabelled, domain, hooks.rowAlias)
}
