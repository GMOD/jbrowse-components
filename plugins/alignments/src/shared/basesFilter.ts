import { layerFilterProblems } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { floorOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import { entriesOn, mergeFilter, withFields } from './alignmentsFilter.ts'

import type { BasesFilter } from './types.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { CytosineContext } from '@jbrowse/modifications-utils'

export const PROBABILITY = 'probability'
export const CONTEXT = 'context'
export const CODE = 'code'
const CONTEXTS: readonly string[] = ['CG', 'CHG', 'CHH']
const PATH = 'pileup.bases.filter'

/**
 * What `pileup.bases.filter` applies with nothing written: calls of
 * probability 0.1 and up, in the by-type view, and the CG context. A written
 * entry replaces these on its own field, and a bare `{ field }` drops them.
 */
export const BASES_FILTER_DEFAULTS: readonly FieldPredicate[] = [
  { field: PROBABILITY, gte: 0.1 },
  { field: CONTEXT, oneOf: ['CG'] },
]

function valuesOf(entries: FieldPredicate[]) {
  const named = entries.filter(p => p.oneOf || p.equal !== undefined)
  return named.length > 0
    ? named.flatMap(p => [
        ...(p.oneOf ?? []).map(String),
        ...(p.equal === undefined ? [] : [String(p.equal)]),
      ])
    : undefined
}

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
  patch: Readonly<Record<string, readonly FieldPredicate[] | undefined>>,
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
  const predicates = predicatesOf(filter)
  const contexts = valuesOf(entriesOn(predicates, CONTEXT))
  return [
    ...layerFilterProblems(PATH, predicates, {
      [PROBABILITY]: { tests: ['gte', 'gt'], max: 1 },
      [CONTEXT]: { tests: ['oneOf', 'equal'] },
      [CODE]: { tests: ['oneOf', 'equal'] },
    }),
    ...(contexts &&
    !(
      contexts.every(c => CONTEXTS.includes(c)) &&
      (new Set(contexts).size === 1 || new Set(contexts).size === 3)
    )
      ? [
          `${PATH}: context takes one of ${CONTEXTS.join(', ')}, or none to take all three, not ${JSON.stringify(contexts)}`,
        ]
      : []),
  ]
}
