import { lowerBoundOf, predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import { DEFAULT_MODIFICATION_THRESHOLD } from './types.ts'

import type { ModificationColorBy } from './types.ts'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { CytosineContext } from '@jbrowse/modifications-utils'

const PROBABILITY = 'probability'
const CONTEXT = 'context'
const CODE = 'code'
const DEFAULT_CONTEXT = 'CG'
const CONTEXTS: ReadonlySet<string> = new Set(['CG', 'CHG', 'CHH'])

type BasesFilterSettings = Pick<
  ModificationColorBy,
  'threshold' | 'cytosineContext' | 'shownModifications'
>

function percentOf(fraction: number) {
  return Number((fraction * 100).toFixed(6))
}

function entriesOn(predicates: FieldPredicate[], field: string) {
  return predicates.filter(p => p.field === field)
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
  const contexts = context.find(p => p.oneOf)?.oneOf
  const codes = entriesOn(predicates, CODE).find(p => p.oneOf)?.oneOf
  return {
    ...(probability.length > 0
      ? { threshold: percentOf(lowerBoundOf(probability, PROBABILITY) ?? 0) }
      : {}),
    ...(context.length > 0
      ? {
          cytosineContext: (contexts?.length === 1 &&
          CONTEXTS.has(String(contexts[0]))
            ? String(contexts[0])
            : 'all') as CytosineContext,
        }
      : {}),
    ...(codes ? { shownModifications: codes.map(String) } : {}),
  }
}

/** The `pileup.bases.filter` list stating `mods`, its defaults left out. */
export function basesFilterOf(mods: ModificationColorBy): FieldPredicate[] {
  const { threshold, cytosineContext, shownModifications } = mods
  return [
    ...(threshold !== undefined && threshold !== DEFAULT_MODIFICATION_THRESHOLD
      ? [{ field: PROBABILITY, gte: threshold / 100 }]
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

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * A beta `modifications.threshold` (a percent), `cytosineContext` and
 * `shownModifications` as `pileup.bases.filter` entries, under any the
 * snapshot writes there on the same field.
 */
export function liftModificationThresholds(snapshot: Record<string, unknown>) {
  const { modifications, pileup } = snapshot
  if (
    !isObject(modifications) ||
    !['threshold', 'cytosineContext', 'shownModifications'].some(
      k => k in modifications,
    )
  ) {
    return snapshot
  }
  const { threshold, cytosineContext, shownModifications, ...rest } =
    modifications
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
  if (lifted.length === 0) {
    return { ...snapshot, modifications: rest }
  }
  const bases = isObject(pileup) && isObject(pileup.bases) ? pileup.bases : {}
  const written = predicatesOf(bases.filter)
  const writtenFields = new Set(written.map(p => p.field))
  return {
    ...snapshot,
    modifications: rest,
    pileup: {
      ...(isObject(pileup) ? pileup : {}),
      bases: {
        ...bases,
        filter: [
          ...lifted.filter(p => !writtenFields.has(p.field)),
          ...written,
        ],
      },
    },
  }
}
