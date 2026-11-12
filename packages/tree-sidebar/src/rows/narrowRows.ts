import {
  compilePredicates,
  testsSomething,
  unreadFields,
} from '@jbrowse/core/util/fieldPredicate'

import { rowFieldValue } from './rowFields.ts'

import type { RowAlias } from './arrangeRows.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/**
 * What narrows the rows shown: `rows.filter`'s predicates over row
 * attributes, then `rows.kept`'s names, a name keeping every row answering to
 * it through `rowAlias`.
 */
export interface RowNarrowing {
  kept: readonly string[]
  filter: readonly FieldPredicate[]
  rowAlias?: RowAlias
}

/**
 * Whether `narrowing` narrows anything: a name kept, or a predicate stating
 * a test, since one stating none admits every row.
 */
export function narrows({ kept, filter }: RowNarrowing) {
  return kept.length > 0 || filter.some(testsSomething)
}

/**
 * The rows every `filter` predicate admits, each reading the row attribute
 * its field names; a row missing it (absent or '') fails every test but
 * `valid: false`.
 */
export function filteredRows<T extends { name: string }>(
  rows: T[],
  filter: readonly FieldPredicate[],
): T[] {
  const test = compilePredicates<T>(filter, field => ({
    kind: 'get',
    get: row => rowFieldValue(row, field),
  }))
  return test ? rows.filter(row => test(row)) : rows
}

/**
 * The one narrowing every reader of the shown rows goes through: `filter`,
 * then `kept`. The rows themselves while neither narrows.
 */
export function narrowRows<T extends { name: string }>(
  rows: T[],
  { kept, filter, rowAlias }: RowNarrowing,
): T[] {
  return keptRows(filteredRows(rows, filter), kept, rowAlias)
}

/** The `kept` names no row answers to, by its own name or its alias. */
export function unmatchedKeptNames(
  rows: readonly { name: string }[],
  { kept, rowAlias }: RowNarrowing,
) {
  const names = new Set(rows.map(row => row.name))
  return kept.filter(name => !names.has(name) && rowAlias?.(name) === undefined)
}

/** The `filter` fields no row carries, each of which hides every row. */
export function unreadRowFields(
  rows: readonly object[],
  filter: readonly FieldPredicate[],
) {
  return unreadFields(filter, field =>
    rows.some(row => rowFieldValue(row, field) !== ''),
  )
}

function testWords(p: FieldPredicate) {
  return [
    ...(p.equal === undefined ? [] : [`is ${String(p.equal)}`]),
    ...(p.oneOf === undefined ? [] : [`is one of ${p.oneOf.join(', ')}`]),
    ...(p.gt === undefined ? [] : [`> ${p.gt}`]),
    ...(p.gte === undefined ? [] : [`≥ ${p.gte}`]),
    ...(p.lt === undefined ? [] : [`< ${p.lt}`]),
    ...(p.lte === undefined ? [] : [`≤ ${p.lte}`]),
    ...(p.valid === undefined
      ? []
      : [p.valid ? 'has a value' : 'has no value']),
  ]
}

/** A predicate list in words: `population is one of EUR, AFR and age ≥ 30`. */
export function rowFilterText(filter: readonly FieldPredicate[]) {
  return filter
    .flatMap(p => testWords(p).map(words => `${p.field} ${words}`))
    .join(' and ')
}

const LISTED_NAMES = 5

/** Names in a notice: the first few, and how many more. */
export function listedNames(names: readonly string[]) {
  const shown = names.slice(0, LISTED_NAMES).join(', ')
  return names.length > LISTED_NAMES
    ? `${shown} and ${names.length - LISTED_NAMES} more`
    : shown
}

/**
 * The row-side half of treeOfLeaves: the rows `kept` names, in the rows'
 * order, so the dendrogram's leaves and the rows drawn beside it cannot
 * disagree about who survived. Every row, the input array itself, while it
 * names none, so callers can short-circuit on identity. A list naming no
 * current row keeps none, and the display says so.
 *
 * - Keyed on `name`, never a per-plugin alias like `sampleName`: the list
 *   holds tree *leaf* names, and phased variant clustering makes those
 *   haplotype names ("HG001 HP1") rather than sample names.
 * - Hide-only. Anything derived from a row's index in the full list (an index
 *   palette color, a group color) is computed before this, or focusing a clade
 *   silently recolors the rows it kept.
 *
 * With `rowAlias`, a name keeps every row answering to it, so a sample's name
 * keeps its haplotypes; and a row that is its own alias (a sample not yet
 * expanded) stands for the rows answering to it, so it is kept when any of
 * them is named. One `kept` then narrows the samples a fetch asks for and the
 * haplotype rows drawn alike.
 */
export function keptRows<T extends { name: string }>(
  rows: T[],
  kept: readonly string[] | undefined,
  rowAlias?: RowAlias,
): T[] {
  if (!rowAlias || !kept?.length) {
    const named = new Set(kept)
    return named.size ? rows.filter(r => named.has(r.name)) : rows
  }
  const samples = new Set(
    kept.flatMap(name => {
      const sample = rowAlias(name)
      return sample === undefined ? [] : [sample]
    }),
  )
  const ofSamples = rows.filter(row =>
    samples.has(rowAlias(row.name) ?? row.name),
  )
  const names = new Set(kept)
  const exact = ofSamples.filter(row => {
    const sample = rowAlias(row.name)
    return (
      sample === row.name ||
      names.has(row.name) ||
      (sample !== undefined && names.has(sample))
    )
  })
  return exact.length ? exact : ofSamples
}
