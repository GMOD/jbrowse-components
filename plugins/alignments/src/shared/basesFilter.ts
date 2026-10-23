import { layerFilterProblems } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import { floorOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import { DEFAULT_MODIFICATION_THRESHOLD } from './types.ts'

import type { ModificationColorBy } from './types.ts'
import type { RetiredMembers } from '@jbrowse/core/configuration'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { CytosineContext } from '@jbrowse/modifications-utils'

const PROBABILITY = 'probability'
const CONTEXT = 'context'
const CODE = 'code'
const DEFAULT_CONTEXT = 'CG'
const CONTEXTS: readonly string[] = ['CG', 'CHG', 'CHH']
const PATH = 'pileup.bases.filter'

type BasesFilterSettings = Pick<
  ModificationColorBy,
  'threshold' | 'thresholdStrict' | 'cytosineContext' | 'shownModifications'
>

function percentOf(fraction: number) {
  return Number((fraction * 100).toFixed(6))
}

function entriesOn(predicates: FieldPredicate[], field: string) {
  return predicates.filter(p => p.field === field)
}

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

/**
 * The modification settings a `pileup.bases.filter` list states, each field
 * it names and none it leaves to its default: `probability` at least 0.1,
 * `context` CG, every `code`. An entry naming a field with no test drops
 * that field's default.
 */
export function modificationFiltersOf(filter: unknown): BasesFilterSettings {
  const predicates = predicatesOf(filter)
  const probability = entriesOn(predicates, PROBABILITY)
  const context = entriesOn(predicates, CONTEXT)
  const codes = valuesOf(entriesOn(predicates, CODE))
  const floor = floorOf(probability, PROBABILITY)
  return {
    ...(probability.length > 0
      ? {
          threshold: percentOf(floor?.min ?? 0),
          ...(floor?.strict ? { thresholdStrict: true } : {}),
        }
      : {}),
    ...(context.length > 0 ? { cytosineContext: contextOf(context) } : {}),
    ...(codes ? { shownModifications: codes } : {}),
  }
}

/** The `pileup.bases.filter` list stating `mods`, its defaults left out. */
export function basesFilterOf(mods: ModificationColorBy): FieldPredicate[] {
  const { threshold, thresholdStrict, cytosineContext, shownModifications } =
    mods
  return [
    ...(threshold !== undefined &&
    (threshold !== DEFAULT_MODIFICATION_THRESHOLD || thresholdStrict)
      ? [
          {
            field: PROBABILITY,
            [thresholdStrict ? 'gt' : 'gte']: threshold / 100,
          },
        ]
      : []),
    ...(cytosineContext === 'all'
      ? [{ field: CONTEXT }]
      : cytosineContext !== undefined && cytosineContext !== DEFAULT_CONTEXT
        ? [{ field: CONTEXT, oneOf: [cytosineContext] }]
        : []),
    ...(shownModifications?.length
      ? [{ field: CODE, oneOf: [...shownModifications] }]
      : []),
  ]
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

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function basesFilterAt(snapshot: Record<string, unknown> | undefined) {
  const pileup = snapshot?.pileup
  const bases = isObject(pileup) ? pileup.bases : undefined
  return isObject(bases) ? bases.filter : undefined
}

const MEMBER_FIELDS = {
  threshold: PROBABILITY,
  cytosineContext: CONTEXT,
  shownModifications: CODE,
} as const

/**
 * A beta `modifications.threshold` (a percent), `cytosineContext` and
 * `shownModifications`, as the `pileup.bases.filter` entries on
 * `probability`, `context` and `code`: under any entry the snapshot writes
 * on the same field, and over a stored delta's base on it, a `null` dropping
 * the base's.
 */
export const retiredModificationMembers: RetiredMembers = {
  names: Object.keys(MEMBER_FIELDS),
  lift: (values, written, base) => {
    const { threshold, cytosineContext, shownModifications } = values
    const lifted = basesFilterOf({
      threshold: typeof threshold === 'number' ? threshold : undefined,
      cytosineContext:
        typeof cytosineContext === 'string'
          ? (cytosineContext as CytosineContext)
          : undefined,
      shownModifications: Array.isArray(shownModifications)
        ? shownModifications.map(String)
        : undefined,
    })
    const writtenFilter = basesFilterAt(written)
    const own = predicatesOf(writtenFilter)
    const under =
      writtenFilter === undefined ? predicatesOf(basesFilterAt(base)) : []
    const ownFields = new Set(own.map(p => p.field))
    const named = new Set<string>(
      Object.entries(MEMBER_FIELDS)
        .filter(([name]) => Object.hasOwn(values, name))
        .map(([, field]) => field),
    )
    const filter = [
      ...under.filter(p => !named.has(p.field) && !ownFields.has(p.field)),
      ...lifted.filter(p => !ownFields.has(p.field)),
      ...own,
    ]
    return filter.length > 0 || under.length > 0
      ? { pileup: { bases: { filter } } }
      : {}
  },
}
