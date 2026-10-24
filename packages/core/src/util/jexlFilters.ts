// own module, not the configuration barrel: that barrel re-exports modules
// which import this one, and a value import back into it is the cycle shape
// `openFeatureWidget` documents
import { setConf } from '../configuration/getConf.ts'
import { baseDisplayConfig } from './baseDisplayConfig.ts'
import { isExpressionEntry, predicatesOf } from './fieldPredicate.ts'
import { ensureJexlPrefix } from './jexlStrings.ts'

import type { AnyConfigurationModel } from '../configuration/types.ts'
import type { RetiredDisplayState } from '../pluggableElementTypes/DisplayType.ts'
import type { Reversible } from '../ui/filterMenuItems.ts'
import type { FieldPredicate } from './fieldPredicate.ts'

/**
 * The feature-filter contract, shared by every display offering a "Filter
 * by..." row: the **`jexl:` expressions** of the display's `filter` list,
 * each an entry that must hold (`{ field: "jexl:…", equal: true }`, or the
 * bare string it lifts from), on the canvas, mark and variant displays. The
 * dialog, a feature's "Filter" actions and "Edit plot..." all write them, and
 * the session keeps the write as it keeps any track setting, so "Reset track
 * settings" returns it with the rest. The list's other entries are no part
 * of the contract, and a write of the expressions keeps them.
 */
export interface JexlFilterSource {
  /** The list's expressions, in practice `configuredJexlFilters(self)`. */
  configuredFilters: () => string[]
}

/**
 * The writing half, for the dialog and the menu's clear row. Separate from
 * {@link JexlFilterSource} because a display declares its readers in an
 * earlier `.views()` block than the `.actions()` block declaring its setter.
 */
export interface JexlFilterModel extends JexlFilterSource {
  /** What the track's config declares, which "Clear all filters" returns to. */
  baseFilters: () => string[]
  /** Write the expressions; undefined returns them to {@link baseFilters}. */
  setFilter: (filters?: string[]) => void
}

/**
 * The `jexl:` expressions a `filter` list states, off the list node, a
 * snapshot or a config entry no schema has lifted.
 */
export function filterExpressionsOf(filter: unknown): string[] {
  return predicatesOf(filter)
    .filter(isExpressionEntry)
    .map(p => p.field)
}

/** The expressions `filter` holds: a display's `configuredFilters`. */
export function configuredJexlFilters(self: {
  configuration: AnyConfigurationModel
}): string[] {
  return filterExpressionsOf(self.configuration.filter)
}

/**
 * What the track's config declares for this display's expressions, before the
 * session wrote any: a display's `baseFilters`. Empty in a session that keeps
 * no base.
 */
export function baseJexlFilters(self: object): string[] {
  return filterExpressionsOf(baseDisplayConfig(self).filter)
}

/**
 * Writes `expressions` as the `filter` list's expression entries, after its
 * other entries, which stay as they were: a display's `setFilter`.
 */
export function writeJexlFilters(
  self: { configuration: AnyConfigurationModel },
  expressions: readonly string[],
) {
  setConf(self.configuration, 'filter', [
    ...predicatesOf(self.configuration.filter).filter(
      p => !isExpressionEntry(p),
    ),
    ...expressions.map(e => ({ field: ensureJexlPrefix(e), equal: true })),
  ])
}

/**
 * The `Reversible` for the `filter` fields `selects` picks (ADR-204): the
 * count is how many differ from what the track's config declares, and the
 * clear writes the declared entries back, so a filter an admin declared is
 * never one the user narrowed. Both sides compare as written, before any
 * display's defaults merge in.
 */
export function filterFieldNarrowing(
  self: { configuration: AnyConfigurationModel },
  selects: (field: string) => boolean,
): Reversible {
  const written = predicatesOf(self.configuration.filter)
  const base = predicatesOf(baseDisplayConfig(self).filter)
  // the `jexl:` expressions count as one filter, as the dialog edits them
  const keyOf = (p: FieldPredicate) =>
    p.field.startsWith('jexl:') ? 'jexl:' : p.field
  const entriesOn = (list: FieldPredicate[], key: string) =>
    JSON.stringify(list.filter(p => selects(p.field) && keyOf(p) === key))
  const moved = new Set(
    [...written, ...base]
      .filter(p => selects(p.field))
      .map(keyOf)
      .filter(key => entriesOn(written, key) !== entriesOn(base, key)),
  )
  const isMoved = (p: FieldPredicate) => selects(p.field) && moved.has(keyOf(p))
  return {
    count: moved.size,
    // off the list as it stands when run: "Clear all" runs one clear after
    // another, and the list this one read may be gone by then
    clear: () => {
      setConf(self.configuration, 'filter', [
        ...predicatesOf(self.configuration.filter).filter(p => !isMoved(p)),
        ...base.filter(isMoved),
      ])
    },
  }
}

/**
 * @deprecated `filterFieldNarrowing(self, () => true)`, which counts a field
 * predicate too, where this counts only the `jexl:` entries and so missed a
 * `{ field, gte }` that hid features.
 *
 * The `Reversible` a display declares for its jexl filters. The count is
 * whether the filters differ from what the track's config declares, not the
 * number of expressions: a filter an admin declared is not something the user
 * narrowed. It counts in both directions, narrowing further and, emptied over
 * a config that declares filters, widening past it.
 */
export function jexlFilterNarrowing(self: JexlFilterModel): Reversible {
  const current = self.configuredFilters()
  const base = self.baseFilters()
  return {
    count:
      current.length !== base.length || current.some((f, i) => f !== base[i])
        ? 1
        : 0,
    clear: () => {
      self.setFilter(undefined)
    },
  }
}

/**
 * A v4 session's display-instance `jexlFiltersSetting`: the `filter` list's
 * expressions now, the retired state the canvas and single-sample variant
 * displays declare (ADR-168).
 */
export const retiredFilterState: RetiredDisplayState = {
  keys: ['jexlFiltersSetting'],
  lift: ({ jexlFiltersSetting }) =>
    Array.isArray(jexlFiltersSetting)
      ? {
          filter: jexlFiltersSetting.map(f => ensureJexlPrefix(String(f))),
        }
      : {},
}
