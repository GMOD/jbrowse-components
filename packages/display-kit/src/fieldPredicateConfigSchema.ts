import {
  ConfigurationSchema,
  getConfigurationSchemaMetadata,
  isConfigurationSchemaType,
  plotList,
} from '@jbrowse/core/configuration'
import { PredicateField } from '@jbrowse/core/util/types/mst'
import { getType, isType, types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

const Scalar = types.union(types.string, types.number, types.boolean)

const TESTS = new Set([
  'equal',
  'lt',
  'lte',
  'gt',
  'gte',
  'oneOf',
  'valid',
  'range',
])
const COMMENT_KEY = /^_+comment/

function tighter(
  written: unknown,
  end: unknown,
  pick: (a: number, b: number) => number,
) {
  return typeof end !== 'number'
    ? written
    : typeof written === 'number'
      ? pick(written, end)
      : end
}

function liftRange(snap: Record<string, unknown>) {
  const { range, ...rest } = snap
  if (!Array.isArray(range)) {
    return rest
  }
  const [lo, hi] = range as unknown[]
  const gte = tighter(rest.gte, lo, Math.max)
  const lte = tighter(rest.lte, hi, Math.min)
  return {
    ...rest,
    ...(gte === undefined ? {} : { gte }),
    ...(lte === undefined ? {} : { lte }),
  }
}

const warnedEmptied = new Set<string>()

// An entry that wrote tests and has none left once a null or an unknown
// operator drops: it loads as no entry, never as a bare `{ field }`
function emptied(entry: unknown) {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return false
  }
  const record = entry as Record<string, unknown>
  const written = Object.keys(record).filter(
    key => key !== 'field' && !COMMENT_KEY.test(key),
  )
  const empty =
    written.length > 0 &&
    !written.some(
      key =>
        TESTS.has(key) &&
        record[key] !== null &&
        record[key] !== undefined &&
        !(
          key === 'range' &&
          Array.isArray(record[key]) &&
          !(record[key] as unknown[]).some(end => typeof end === 'number')
        ),
    )
  if (empty) {
    const text = JSON.stringify(record)
    if (!warnedEmptied.has(text)) {
      warnedEmptied.add(text)
      console.warn(
        `filter entry ${text} states no test this release applies: loading without it`,
      )
    }
  }
  return empty
}

/**
 * #config FieldPredicate
 * #category display
 * One entry of a `filter` list, Vega-Lite's field predicate: the `field` of
 * each record and the tests its value must pass, every one given. A `filter`
 * list admits a record that passes every entry. A value is missing when it is
 * absent, empty, or a VCF's `.`; `valid: false` selects exactly those. A
 * comparison reads the value as a number, so a missing value and text that
 * is no number both fail it.
 *
 * An entry whose every written test is `null` or one this release does not
 * know loads as no entry at all, with a warning: R's `NA` and Python's `None`
 * write `null`, and a bare `{ field }` would remove that field's defaults.
 *
 * A `field` written `jexl:` is computed per feature, where the display reads
 * jexl, and a bare string entry is one that must hold:
 * `"jexl:feature.score > 100"` is `{ field: "jexl:feature.score > 100",
 * equal: true }`.
 *
 * #example
 * ```js
 * filter: [{ field: 'length', gte: 10000 }, { field: 'identity', gte: 0.9 }]
 * ```
 * ```js
 * filter: [{ field: 'query', oneOf: ['chr1', 'chr2'] }]
 * ```
 * ```js
 * filter: [{ field: 'score', range: [100, 500] }]
 * ```
 * ```js
 * filter: [{ field: 'gene_group', valid: true }]
 * ```
 * ```js
 * filter: ['jexl:feature.end - feature.start > 1000']
 * ```
 */
export const fieldPredicateConfigSchema = ConfigurationSchema(
  'FieldPredicate',
  {
    /**
     * #slot
     */
    field: {
      type: 'featureField',
      model: PredicateField,
      defaultValue: '',
      description:
        'the field tested, as the display names its fields, or a jexl: expression computed per feature',
    },
    /**
     * #slot
     */
    equal: {
      type: 'maybeFrozen',
      model: types.maybe(Scalar),
      description: 'the value must equal this',
    },
    /**
     * #slot
     */
    lt: { type: 'maybeNumber', description: 'the value must be below this' },
    /**
     * #slot
     */
    lte: { type: 'maybeNumber', description: 'the value must be at most this' },
    /**
     * #slot
     */
    gt: { type: 'maybeNumber', description: 'the value must be above this' },
    /**
     * #slot
     */
    gte: {
      type: 'maybeNumber',
      description: 'the value must be at least this',
    },
    /**
     * #slot
     */
    oneOf: {
      type: 'maybeFrozen',
      model: types.maybe(types.array(Scalar)),
      description: 'the value must be one of these',
    },
    /**
     * #slot
     */
    range: {
      type: 'maybeFrozen',
      model: types.maybe(types.array(types.maybeNull(types.number))),
      description:
        "Vega-Lite's [min, max], both ends included and a null end open; it loads as gte and lte, the tighter bound winning where either is also written",
    },
    /**
     * #slot
     */
    valid: {
      type: 'maybeBoolean',
      description:
        'true admits only records with a value for the field, false only those without',
    },
  },
  {
    closed: true,
    preProcessSnapshot: liftRange,
    shorthand: 'field',
    shorthandWith: { equal: true },
    writes: 'whole',
  },
)

export interface FieldPredicateConfig extends Instance<
  typeof fieldPredicateConfigSchema
> {}

/**
 * A list of predicates without the entries whose tests all dropped, the
 * `filter` slot's type wherever a list of predicates is stored.
 */
export function fieldPredicateArray() {
  return types.snapshotProcessor(types.array(fieldPredicateConfigSchema), {
    preProcessor: (snap: unknown) =>
      Array.isArray(snap) ? snap.filter(entry => !emptied(entry)) : snap,
  })
}

const listDefaults = new WeakMap<IAnyType, readonly FieldPredicate[]>()

/**
 * A display's `filter` slot: a list of predicates, edited by "Edit plot...".
 * `defaults` are the entries a written list merges with by field (ADR-240):
 * an entry replaces its field's defaults, and `{ field }` alone removes
 * them. Declared here, Edit plot lists them beside the written list.
 */
export function fieldPredicateList({
  defaults,
}: { defaults?: readonly FieldPredicate[] } = {}) {
  const type = fieldPredicateArray()
  if (defaults) {
    listDefaults.set(type, defaults)
  }
  return plotList(type)
}

/** Every predicate list under a config that declares defaults, by its path. */
export function predicateListDefaults(
  conf: AnyConfigurationModel,
): { path: string; entries: readonly FieldPredicate[] }[] {
  const walk = (
    type: IAnyType,
    prefix: string,
  ): { path: string; entries: readonly FieldPredicate[] }[] =>
    Object.entries(
      getConfigurationSchemaMetadata(type)?.definition ?? {},
    ).flatMap(([key, entry]) => {
      const defaults = isType(entry) ? listDefaults.get(entry) : undefined
      return defaults
        ? [{ path: `${prefix}${key}`, entries: defaults }]
        : isConfigurationSchemaType(entry)
          ? walk(entry, `${prefix}${key}.`)
          : []
    })
  return walk(getType(conf), '')
}
