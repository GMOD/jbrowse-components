// own module, not the configuration barrel: that barrel re-exports modules
// which import this one, and a value import back into it is the cycle shape
// `openFeatureWidget` documents
import { types } from '@jbrowse/mobx-state-tree'

import { getConf } from '../configuration/getConf.ts'
import { ensureJexlPrefix } from './jexlStrings.ts'
import { JexlExpressionString } from './types/mst.ts'

import type { Reversible } from '../ui/filterMenuItems.ts'

/**
 * The two-tier feature-filter contract, shared by every display offering a
 * "Filter by..." row. Two tiers because the setting has two authors:
 *
 * - the **`filter` config slot**, which an admin declares in a track config:
 *   `jexlFilterConfigSchemaFields` in display-kit, spread by the canvas base
 *   display schema, the mark display schema and the shared multi-sample
 *   variant schema — the three whose models read it.
 * - the **`filterSetting` display property**, which the dialog writes. Set —
 *   *even to an empty list* — it replaces the config tier entirely, which is
 *   what makes "clear the filters an admin declared" expressible.
 *
 * Both hold `jexl:` expressions and refuse a bare string.
 */
export interface JexlFilterSource {
  /**
   * The dialog's override. `undefined` means "follow the config slot"; an
   * empty array means "the user cleared them".
   */
  filterSetting?: readonly string[]
  /**
   * The config tier — in practice `configuredJexlFilters(self)`. A member rather than a read this module does
   * itself, so the two things that consume this contract off a **duck-typed**
   * model — LD's structural menu builder and its shape test — need no live
   * config node to answer a count with.
   */
  configuredFilters: () => string[]
}

/**
 * The writing half, for the dialog and the menu's clear row. Separate from
 * {@link JexlFilterSource} because a display declares `activeFilters()` in an
 * earlier `.views()` block than the `.actions()` block declaring its setter, so
 * requiring the setter to *read* the filters would put the two in an order MST
 * cannot satisfy.
 */
export interface JexlFilterModel extends JexlFilterSource {
  setFilter: (filters?: string[]) => void
}

/** The `filterSetting` property, for a display model to declare. */
export const FilterSetting = types.maybe(types.array(JexlExpressionString))

/**
 * A snapshot's v4 `jexlFiltersSetting` as `filterSetting`, for the
 * `preProcessSnapshot` of the model declaring {@link FilterSetting}.
 */
export function liftRetiredFilterSetting<T>(snap: T): T {
  if (!snap || typeof snap !== 'object' || !('jexlFiltersSetting' in snap)) {
    return snap
  }
  const { jexlFiltersSetting, ...rest } = snap as Record<string, unknown>
  return (
    Array.isArray(jexlFiltersSetting) && !('filterSetting' in rest)
      ? { ...rest, filterSetting: jexlFiltersSetting.map(ensureJexlPrefix) }
      : rest
  ) as T
}

/** What the `filter` config slot alone declares: a display's `configuredFilters`. */
export function configuredJexlFilters(
  self: Parameters<typeof getConf>[0],
): string[] {
  return getConf(self, 'filter')
}

/**
 * The filters actually applied — the single source of truth
 * for the worker (via `rpcProps`), for the "Filter by..." dialog (so config
 * filters show up and are editable), and for the narrowing count below.
 */
export function activeJexlFilters(self: JexlFilterSource): string[] {
  const { filterSetting } = self
  return filterSetting ? [...filterSetting] : self.configuredFilters()
}

/**
 * The `Reversible` a display declares for its jexl filters.
 *
 * The count is whether the override **differs from the configured baseline**,
 * not the number of expressions: a filter an admin declared is not something
 * the user narrowed, and "Clear all filters" could not undo it anyway. It
 * counts in both directions when they differ — narrowing further, and (emptied
 * over a slot that declares filters) widening past what the config asked for.
 *
 * No per-item row: a list of jexl expressions has no recovery to name beyond
 * restoring the config default, which the group clear already is.
 */
export function jexlFilterNarrowing(self: JexlFilterModel): Reversible {
  const override = self.filterSetting
  const configured = self.configuredFilters()
  return {
    count:
      override !== undefined &&
      (override.length !== configured.length ||
        override.some((f, i) => f !== configured[i]))
        ? 1
        : 0,
    clear: () => {
      self.setFilter(undefined)
    },
  }
}
