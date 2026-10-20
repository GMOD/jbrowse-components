// own module, not the configuration barrel: that barrel re-exports modules
// which import this one, and a value import back into it is the cycle shape
// `openFeatureWidget` documents
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { getConf, setConf } from '../configuration/getConf.ts'
import { baseDisplayConfig } from './baseDisplayConfig.ts'
import { deepEqual } from './deepEqual.ts'
import { ensureJexlPrefix } from './jexlStrings.ts'

import type { AnyConfigurationModel } from '../configuration/types.ts'
import type { RetiredDisplayState } from '../pluggableElementTypes/DisplayType.ts'
import type { Reversible } from '../ui/filterMenuItems.ts'

/**
 * The feature-filter contract, shared by every display offering a "Filter
 * by..." row: **`filter.expressions`** holds the filters applied, as `jexl:`
 * expressions (`featureFilterConfigSchema` in display-kit, on the canvas, mark
 * and multi-sample variant displays). The dialog, a feature's "Filter" actions
 * and "Edit plot..." all write that member, and the session keeps the write as
 * it keeps any track setting, so "Reset track settings" returns it with the
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
  /** Write the expressions; undefined returns them to {@link baseFilters}. */
  setFilter: (filters?: string[]) => void
}

/** What `filter.expressions` holds: a display's `configuredFilters`. */
export function configuredJexlFilters(
  self: Parameters<typeof getConf>[0],
): string[] {
  return getConf(self, ['filter', 'expressions'])
}

/**
 * The expressions a config entry's `filter` states, in either spelling: the
 * object's `expressions`, or the list shorthand. For a reader of a snapshot,
 * where no schema has lifted the shorthand yet.
 */
export function filterExpressionsOf(filter: unknown): string[] {
  const list = Array.isArray(filter)
    ? filter
    : (filter as { expressions?: unknown } | undefined)?.expressions
  return Array.isArray(list) ? list.map(String) : []
}

/**
 * What the track's config declares for this display's `filter.expressions`,
 * before the session wrote any: a display's `baseFilters`. Empty in a session
 * that keeps no base.
 */
export function baseJexlFilters(self: object): string[] {
  return filterExpressionsOf(baseDisplayConfig(self).filter)
}

/**
 * What the track's config declares for this display's `filter`, as a snapshot
 * writes it, a default left out: `{}` where it declares none.
 */
export function baseFilterOf(self: object): Record<string, unknown> {
  const { filter } = baseDisplayConfig(self)
  return Array.isArray(filter)
    ? { expressions: filter }
    : typeof filter === 'object' && filter !== null
      ? (filter as Record<string, unknown>)
      : {}
}

/**
 * The `Reversible` for members of a display's `filter` (ADR-204): the count is
 * how many differ from what the track's config declares, and the clear writes
 * the declared values back, so a filter an admin declared is never one the
 * user narrowed. Both sides compare as snapshots, a default left out of each.
 */
export function filterMembersNarrowing(
  self: { configuration: AnyConfigurationModel },
  members: readonly string[],
): Reversible {
  const base = baseFilterOf(self)
  const written = getSnapshot<Record<string, unknown> | undefined>(
    self.configuration.filter,
  )
  const moved = members.filter(
    member => !deepEqual(written?.[member], base[member]),
  )
  return {
    count: moved.length,
    clear: () => {
      for (const member of moved) {
        setConf(self, ['filter', member], base[member] ?? null)
      }
    },
  }
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
 * A v4 session's display-instance `jexlFiltersSetting`, which is
 * `filter.expressions` now: the retired state the canvas and single-sample
 * variant displays declare (ADR-168).
 */
export const retiredFilterState: RetiredDisplayState = {
  keys: ['jexlFiltersSetting'],
  lift: ({ jexlFiltersSetting }) =>
    Array.isArray(jexlFiltersSetting)
      ? {
          filter: {
            expressions: jexlFiltersSetting.map(f =>
              ensureJexlPrefix(String(f)),
            ),
          },
        }
      : {},
}
