import { groupKeyComparator } from '@jbrowse/core/util/groupKeys'

import type { RowSource } from './types.ts'

/** The row channel a reader's colour for a row lands on. */
export type IdentityChannel = 'color' | 'labelColor'

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

export interface RowArrangementInput {
  domain: readonly string[]
  labels: Readonly<Record<string, string>>
  rowColors: ReadonlyMap<string, string>
}

export interface ArrangeRowsHooks {
  readonly identityChannel: IdentityChannel
  readonly unlistedRowsSort: UnlistedRowsSort
  readonly rowAlias: RowAlias | undefined
}

type OtherOf = (index: number) => string | undefined

function otherName(alias: RowAlias, name: string) {
  const other = alias(name)
  return other === name ? undefined : other
}

function otherOfRow(
  rows: readonly { name: string }[],
  alias: RowAlias | undefined,
): OtherOf | undefined {
  return alias && (i => otherName(alias, rows[i]!.name))
}

/**
 * A row's own entry, else its alias's. Own-property reads, since row names
 * come from files and a row called `constructor` would otherwise read one off
 * `Object.prototype`.
 */
function labelEntry(
  labels: Readonly<Record<string, string>>,
  name: string,
  other: string | undefined,
) {
  return Object.hasOwn(labels, name)
    ? labels[name]
    : other !== undefined && Object.hasOwn(labels, other)
      ? labels[other]
      : undefined
}

function colorEntry(
  rowColors: ReadonlyMap<string, string>,
  name: string,
  other: string | undefined,
) {
  return (
    rowColors.get(name) ??
    (other === undefined ? undefined : rowColors.get(other))
  )
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

function orderByRank<S extends { name: string }>(
  rows: S[],
  domain: readonly string[],
  otherOf: OtherOf | undefined,
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
  const ranks = new Int32Array(rows.length).fill(-1)
  const starts = new Int32Array(domain.length + 1)
  let listed = 0
  for (let i = 0; i < rows.length; i++) {
    let r = rank.get(rows[i]!.name)
    if (r === undefined && otherOf) {
      const other = otherOf(i)
      r = other === undefined ? undefined : rank.get(other)
    }
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
  rowColors: ReadonlyMap<string, string>,
  channel: IdentityChannel,
  others: readonly (string | undefined)[] | undefined,
) {
  let out: S[] | undefined
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const other = others?.[i]
    const label = labelEntry(labels, row.name, other)
    const color = colorEntry(rowColors, row.name, other)
    if (
      (label !== undefined && label !== row.label) ||
      (color !== undefined && color !== row[channel])
    ) {
      out ??= [...rows]
      out[i] = {
        ...row,
        ...(label === undefined ? {} : { label }),
        ...(color === undefined
          ? {}
          : channel === 'color'
            ? { color }
            : { labelColor: color }),
      }
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
  return orderByRank(rows, domain, otherOfRow(rows, rowAlias))
}

/**
 * The rows in a reader's arrangement: the rows `domain` lists lead, in its
 * order, and the rest follow as `unlistedRowsSort` says; a `labels` entry
 * replaces a row's label and a `rowColors` entry lands on the row's
 * `identityChannel`. Where `rowAlias` is given, a row with no entry of its own
 * answers to its alias's, so an order, a label or a tint written against a
 * sample reaches each of its haplotypes.
 *
 * Hands back `rows` itself whenever nothing moves or changes, so a consumer
 * keyed on identity sees no change.
 */
export function arrangeRows<S extends RowSource>(
  rows: S[],
  { domain, labels, rowColors }: RowArrangementInput,
  hooks: ArrangeRowsHooks,
): S[] {
  const alias = hooks.rowAlias
  const relabel = rowColors.size > 0 || Object.keys(labels).length > 0
  const others =
    alias && relabel ? rows.map(row => otherName(alias, row.name)) : undefined
  const relabelled = relabel
    ? relabelRows(rows, labels, rowColors, hooks.identityChannel, others)
    : rows
  return hooks.unlistedRowsSort === 'sorted'
    ? sortedRows(relabelled, domain)
    : orderByRank(
        relabelled,
        domain,
        others ? i => others[i] : otherOfRow(rows, alias),
      )
}
