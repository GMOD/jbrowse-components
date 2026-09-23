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

/**
 * A row's own entry, else its alias's. Own-property reads, since row names
 * come from files and a row called `constructor` would otherwise read one off
 * `Object.prototype`.
 */
export function labelEntry(
  labels: Readonly<Record<string, string>>,
  name: string,
  alias: RowAlias | undefined,
) {
  if (Object.hasOwn(labels, name)) {
    return labels[name]
  }
  const other = alias?.(name)
  return other !== undefined && other !== name && Object.hasOwn(labels, other)
    ? labels[other]
    : undefined
}

export function colorEntry(
  rowColors: ReadonlyMap<string, string>,
  name: string,
  alias: RowAlias | undefined,
) {
  const own = rowColors.get(name)
  if (own !== undefined) {
    return own
  }
  const other = alias?.(name)
  return other === undefined || other === name
    ? undefined
    : rowColors.get(other)
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
  if (!domain.length) {
    return rows
  }
  const rank = new Map<string, number>()
  for (const [i, name] of domain.entries()) {
    if (!rank.has(name)) {
      rank.set(name, i)
    }
  }
  const buckets: S[][] = []
  const unlisted: S[] = []
  let listed = false
  for (const row of rows) {
    const other = rowAlias?.(row.name)
    const r =
      rank.get(row.name) ?? (other === undefined ? undefined : rank.get(other))
    if (r === undefined) {
      unlisted.push(row)
    } else {
      ;(buckets[r] ??= []).push(row)
      listed = true
    }
  }
  if (!listed) {
    return rows
  }
  const ordered = [...buckets.flat(), ...unlisted]
  return ordered.every((row, i) => row === rows[i]) ? rows : ordered
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
  const ordered =
    hooks.unlistedRowsSort === 'sorted'
      ? sortedRows(rows, domain)
      : orderRowsByDomain(rows, domain, alias)
  if (rowColors.size === 0 && Object.keys(labels).length === 0) {
    return ordered
  }
  const channel = hooks.identityChannel
  let changed = ordered !== rows
  const out = ordered.map(row => {
    const label = labelEntry(labels, row.name, alias)
    const color = colorEntry(rowColors, row.name, alias)
    if (
      (label === undefined || label === row.label) &&
      (color === undefined || color === row[channel])
    ) {
      return row
    }
    changed = true
    const tint =
      color === undefined
        ? {}
        : channel === 'color'
          ? { color }
          : { labelColor: color }
    return {
      ...row,
      ...(label === undefined ? {} : { label }),
      ...tint,
    }
  })
  return changed ? out : rows
}
