import {
  compilePredicates,
  testsSomething,
  unreadFields,
} from '@jbrowse/core/util/fieldPredicate'

import { keptRows } from './clusterUtils.ts'
import { rowFieldValue } from './rowColorScale.ts'

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
