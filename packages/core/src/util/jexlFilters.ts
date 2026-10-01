// own module, not the configuration barrel: that barrel re-exports modules
// which import this one, and a value import back into it is the cycle shape
// `openFeatureWidget` documents
import { getConf } from '../configuration/getConf.ts'
import { baseDisplayConfig } from './baseDisplayConfig.ts'
import { ensureJexlPrefix } from './jexlStrings.ts'

import type { RetiredDisplayState } from '../pluggableElementTypes/DisplayType.ts'
import type { Reversible } from '../ui/filterMenuItems.ts'

/**
 * The feature-filter contract, shared by every display offering a "Filter
 * by..." row: the **`filter` config slot** holds the filters applied, as
 * `jexl:` expressions (`jexlFilterConfigSchemaFields` in display-kit, spread
 * by the canvas base display schema, the mark display schema and the shared
 * multi-sample variant schema). The dialog, a feature's "Filter" actions and
 * "Edit plot..." all write that slot, and the session keeps the write as it
 * keeps any track setting, so "Reset track settings" returns it with the
 * rest.
 */
export interface JexlFilterSource {
  /** The slot's filters, in practice `configuredJexlFilters(self)`. */
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
  /** Write the slot; undefined returns it to {@link baseFilters}. */
  setFilter: (filters?: string[]) => void
}

/** What the `filter` config slot holds: a display's `configuredFilters`. */
export function configuredJexlFilters(
  self: Parameters<typeof getConf>[0],
): string[] {
  return getConf(self, 'filter')
}

/**
 * What the track's config declares for this display's `filter`, before the
 * session wrote any: a display's `baseFilters`. Empty in a session that keeps
 * no base.
 */
export function baseJexlFilters(self: object): string[] {
  const declared = baseDisplayConfig(self).filter
  return Array.isArray(declared)
    ? declared.map(f => ensureJexlPrefix(String(f)))
    : []
}

/**
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
 * A v4 session's display-instance `jexlFiltersSetting`, which is the `filter`
 * slot now: the retired state the canvas and single-sample variant displays
 * declare (ADR-168).
 */
export const retiredFilterState: RetiredDisplayState = {
  keys: ['jexlFiltersSetting'],
  lift: ({ jexlFiltersSetting }) =>
    Array.isArray(jexlFiltersSetting)
      ? { filter: jexlFiltersSetting.map(f => ensureJexlPrefix(String(f))) }
      : {},
}
