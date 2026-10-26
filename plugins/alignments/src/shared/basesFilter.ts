import { floorOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import { entriesOn, mergeFilter, withFields } from './alignmentsFilter.ts'
import {
  CODE,
  CONTEXT,
  CONTEXTS,
  PROBABILITY,
  basesEntryProblems,
  valuesOf,
} from './basesFilterRules.ts'

import type { BasesFilter } from './types.ts'
import type {
  FieldPredicate,
  FieldsPatch,
} from '@jbrowse/core/util/fieldPredicate'
import type { CytosineContext } from '@jbrowse/modifications-utils'

export { CODE, CONTEXT, PROBABILITY } from './basesFilterRules.ts'

/**
 * What `pileup.bases.filter` applies with nothing written: calls of
 * probability 0.1 and up, in the by-type view, and the CG context. A written
 * entry replaces these on its own field, and a bare `{ field }` drops them.
 */
export const BASES_FILTER_DEFAULTS: readonly FieldPredicate[] = [
  { field: PROBABILITY, gte: 0.1 },
  { field: CONTEXT, oneOf: ['CG'] },
]

function contextOf(entries: FieldPredicate[]): CytosineContext {
  const values = new Set(valuesOf(entries))
  const [only] = values
  return (
    values.size === 1 && CONTEXTS.includes(only!) ? only : 'all'
  ) as CytosineContext
}

/** A written `pileup.bases.filter` list over its defaults, as the extract reads it. */
export function basesFilterOf(filter: unknown): BasesFilter {
  const merged = mergeFilter(predicatesOf(filter), BASES_FILTER_DEFAULTS)
  const codes = valuesOf(entriesOn(merged, CODE))
  return {
    probability: floorOf(merged, PROBABILITY) ?? { min: 0, strict: false },
    context: contextOf(entriesOn(merged, CONTEXT)),
    ...(codes ? { codes } : {}),
  }
}

export const DEFAULT_BASES_FILTER = basesFilterOf([])

/**
 * The written list with each field the patch names replaced, as `withFields`
 * does for the display's `filter`: `undefined` returns a field to its default.
 */
export function withBasesFields(
  written: readonly FieldPredicate[],
  patch: FieldsPatch,
) {
  return withFields(written, patch, BASES_FILTER_DEFAULTS)
}

/** The `context` entries for one context, none for every cytosine. */
export function contextEntries(context: CytosineContext): FieldPredicate[] {
  return context === 'all' ? [] : [{ field: CONTEXT, oneOf: [context] }]
}

/** The `code` entries drawing `codes`; every code while unset or empty. */
export function codeEntries(codes: readonly string[] | undefined) {
  return codes?.length ? [{ field: CODE, oneOf: [...codes] }] : undefined
}

/** The `pileup.bases.filter` entries the per-base layer cannot apply. */
export function basesFilterProblems(filter: unknown) {
  return basesEntryProblems(predicatesOf(filter))
}
