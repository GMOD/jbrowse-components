import {
  coarseStripHTML,
  localStorageGetBoolean,
  localStorageGetJSON,
  localStorageGetNumber,
  localStorageSetBoolean,
  localStorageSetJSON,
  localStorageSetNumber,
  measureGridWidth,
} from '@jbrowse/core/util'
import { trackCatalogEntry } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { trackNameCollator } from '../shared/collator.ts'
import { configScopedKey } from '../shared/configScopedKey.ts'
import { buildSearchText, searchMatcher } from '../shared/searchText.ts'
import { measureNameColumnWidth } from '../shared/trackGridUtils.ts'
import {
  facetLabel,
  getRowStr,
  isMetadataFacet,
  metadataFacet,
} from './components/util.ts'
import {
  computeFacetCategoryCounts,
  filterRowsByFacets,
  filterRowsByText,
  rowSearchText,
} from './facetedFilter.ts'
import { getRootKeys } from './facetedUtil.ts'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { TrackCatalog } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

// the narrowest a drag can make the filter pane
export const MIN_PANEL_WIDTH = 100

// how many of the default columns' facets start open
const OPEN_FACETS = 3

/**
 * A column the user showed or hid in Manage columns, overriding whether the
 * table would have shown it.
 */
export interface ColumnChoice {
  field: string
  show: boolean
}

// Column choices are config+assembly scoped: the metadata columns differ per
// dataset, so a choice shouldn't carry over to an unrelated config.
function columnChoicesKey(assemblyNames: string[]) {
  return configScopedKey('facet-columnChoices', assemblyNames)
}

function readColumnChoices(assemblyNames: string[]): ColumnChoice[] {
  const stored = localStorageGetJSON<unknown>(
    columnChoicesKey(assemblyNames),
    [],
  )
  return Array.isArray(stored)
    ? stored.flatMap((c: Partial<ColumnChoice> | null) =>
        typeof c?.field === 'string' && typeof c.show === 'boolean'
          ? [{ field: c.field, show: c.show }]
          : [],
      )
    : []
}

function trackFields(
  track: AnyTrackConfig,
  trackTypeName: (type: string) => string,
) {
  const metadata = (track.metadata ?? {}) as Record<string, unknown>
  return {
    kind:
      typeof metadata.kind === 'string' && metadata.kind
        ? metadata.kind
        : trackTypeName(String(track.type)),
    adapter: (track.adapter as { type?: string } | undefined)?.type,
    metadata,
  }
}

// A field groups tracks when at least two of its values are each shared by
// two or more tracks, and it has no more values than half the tracks that have
// one: a constant flag, a lone exception to one, or a per-track URL or
// description gives a column or a facet nothing to group by.
function groupsTracks(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value !== '') {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  const present = values.filter(v => v !== '').length
  const shared = [...counts.values()].filter(n => n >= 2).length
  return shared >= 2 && counts.size <= present / 2
}

/**
 * #stateModel FacetedModel
 * #internal faceted-selector UI state owned by the hierarchical track selector
 * widget — kept out of the website docs
 * #category widget
 */
export function facetedStateTreeF() {
  return types
    .model('FacetedModel', {
      /**
       * #property
       */
      filterText: types.optional(types.string, ''),
      /**
       * #property
       */
      showFilters: types.optional(types.boolean, () =>
        localStorageGetBoolean('facet-showFilters', true),
      ),
      /**
       * #property
       */
      panelWidth: types.optional(types.number, () =>
        localStorageGetNumber('facet-panelWidth', 200),
      ),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      assemblyNames: [] as string[],
      /**
       * #volatile
       */
      useShoppingCart: false,
      /**
       * #volatile
       */
      filters: observable.map<string, string[]>(),
      /**
       * #volatile
       * Field id the grid is sorted by; empty string keeps natural order.
       */
      sortField: '',
      /**
       * #volatile
       */
      sortAscending: true,
      /**
       * #volatile
       * Supplier for the tracks the grid shows. Called from inside the row
       * computeds so they track the live config tree: a track added or deleted
       * while the selector is open flows through instead of leaving a stale row
       * pointing at a destroyed config.
       */
      getTracks: (() => []) as () => AnyTrackConfig[],
      /**
       * #volatile
       * Supplier for the tracks the columns and facets are chosen from, when
       * that is more than the grid shows: the drawer passes every track, so
       * switching to Favorites or Recent keeps the same columns.
       */
      getColumnTracks: undefined as (() => AnyTrackConfig[]) | undefined,
      /**
       * #volatile
       * the config's `hierarchical.table.columns`
       */
      configuredColumns: [] as string[],
      /**
       * #volatile
       * what the user showed or hid in Manage columns, loaded from a
       * config+assembly scoped localStorage entry in setTrackSource
       */
      columnChoices: [] as ColumnChoice[],
      /**
       * #volatile
       */
      session: undefined as TrackCatalog | undefined,
      /**
       * #volatile
       * a track type's name for the kind column, when its config sets no
       * `metadata.kind`
       */
      trackTypeName: (type: string) => type,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setTrackSource(
        getTracks: () => AnyTrackConfig[],
        session: TrackCatalog,
        assemblyNames: string[],
        getColumnTracks?: () => AnyTrackConfig[],
      ) {
        self.getTracks = getTracks
        self.getColumnTracks = getColumnTracks
        self.session = session
        self.assemblyNames = assemblyNames
        self.columnChoices = readColumnChoices(assemblyNames)
      },
      /**
       * #action
       */
      setConfiguredColumns(columns: string[]) {
        self.configuredColumns = columns
      },
      /**
       * #action
       */
      setTrackTypeName(trackTypeName: (type: string) => string) {
        self.trackTypeName = trackTypeName
      },
      /**
       * #action
       */
      setFilter(key: string, value: string[]) {
        self.filters.set(key, value)
      },
      /**
       * #action
       */
      clearFilters() {
        self.filters.clear()
      },
      /**
       * #action
       */
      setSort(field: string, ascending: boolean) {
        self.sortField = field
        self.sortAscending = ascending
      },
      /**
       * #action
       */
      setPanelWidth(width: number) {
        // a drag past the left edge would otherwise give the filter pane a
        // negative width and make the data pane wider than its container
        self.panelWidth = Math.max(MIN_PANEL_WIDTH, width)
        localStorageSetNumber('facet-panelWidth', self.panelWidth)
      },
      /**
       * #action
       */
      setUseShoppingCart(f: boolean) {
        self.useShoppingCart = f
      },
      /**
       * #action
       */
      setFilterText(str: string) {
        self.filterText = str
      },
      /**
       * #action
       */
      setShowFilters(f: boolean) {
        self.showFilters = f
        localStorageSetBoolean('facet-showFilters', f)
      },
      /**
       * #action
       * records the user's Manage columns choice, which beats the default
       * either way; hiding the sorted column drops the sort
       */
      setColumnVisible(field: string, show: boolean) {
        self.columnChoices = [
          ...self.columnChoices.filter(c => c.field !== field),
          { field, show },
        ]
        localStorageSetJSON(
          columnChoicesKey(self.assemblyNames),
          self.columnChoices,
        )
        if (!show && self.sortField === field) {
          self.sortField = ''
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Builds row objects from track configs. Cached and only recomputes when
       * the track list changes, not on every filterText keystroke.
       */
      get allRows() {
        const session = self.session
        return session
          ? self.getTracks().map(track => {
              const { name, category, description } = trackCatalogEntry(
                track,
                session,
              )
              const row = {
                id: track.trackId,
                conf: track,
                name,
                category: category.join(', '),
                description,
                ...trackFields(track, self.trackTypeName),
              }
              return {
                ...row,
                searchText: rowSearchText(row),
                nameSearchText: buildSearchText([name]),
              } as const
            })
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the rows the columns and facets are chosen from
       */
      get columnRows() {
        const { getColumnTracks } = self
        return getColumnTracks
          ? getColumnTracks().map(track => ({
              category: ((track.category as string[] | undefined) ?? []).join(
                ', ',
              ),
              ...trackFields(track, self.trackTypeName),
            }))
          : self.allRows
      },
      /**
       * #getter
       * Text-filtered rows. Cheap string filtering on already-built allRows.
       */
      get rows() {
        return filterRowsByText(self.allRows, self.filterText)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get metadataKeys() {
        return [
          ...new Set(
            self.columnRows.flatMap(row =>
              getRootKeys(row.metadata).filter(key => key !== 'kind'),
            ),
          ),
        ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Every field a column can show, in column order: the ones that say most
       * about a track first, `metadata.<key>` ids next, the adapter last.
       */
      get fields() {
        return [
          'name',
          'description',
          'category',
          'kind',
          ...self.metadataKeys.map(metadataFacet),
          'adapter',
        ]
      },
      /**
       * #getter
       * The fields that sort tracks into groups (see groupsTracks), the ones
       * most tracks have first: what the table shows beside the name when the
       * config names no columns, and what the facet panel lists.
       */
      get groupingFields() {
        const rows = self.columnRows
        return ['category', 'kind', ...self.metadataKeys.map(metadataFacet)]
          .map(field => ({
            field,
            values: rows.map(row => getRowStr(field, row)),
          }))
          .filter(({ values }) => groupsTracks(values))
          .map(({ field, values }) => ({
            field,
            coverage: values.filter(v => v !== '').length,
          }))
          .sort((a, b) => b.coverage - a.coverage)
          .map(({ field }) => field)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the columns shown beside the name, most important first, as far as the
       * width allows: the config's `hierarchical.table.columns`, or else the
       * grouping fields
       */
      get defaultColumns() {
        const known = new Set(self.fields)
        const configured = self.configuredColumns.filter(f => known.has(f))
        return configured.length ? configured : self.groupingFields
      },
      /**
       * #getter
       * The columns the user showed in Manage columns, which show however
       * narrow the table, and those they hid, which never do.
       */
      get chosenColumns() {
        const known = new Set(self.fields)
        const choices = self.columnChoices.filter(c => known.has(c.field))
        return {
          shown: choices.filter(c => c.show).map(c => c.field),
          hidden: new Set(choices.filter(c => !c.show).map(c => c.field)),
        }
      },
      /**
       * #getter
       * The non-metadata field names, used to detect when a metadata key
       * collides with one (so the header can show "x (from metadata)").
       */
      get nonMetadataFieldSet() {
        return new Set(self.fields.filter(f => !isMetadataFacet(f)))
      },
      /**
       * #getter
       */
      get filteredRows() {
        return filterRowsByFacets(self.rows, self.filters)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * every column that can show at some width, name first
       */
      get candidateColumns() {
        const { shown, hidden } = self.chosenColumns
        return [
          ...new Set([
            'name',
            ...self.defaultColumns.filter(f => !hidden.has(f)),
            ...shown,
          ]),
        ]
      },
      /**
       * #getter
       * The facet panel's facets: the default columns and grouping fields,
       * plus any facet still filtering the grid, so an active filter never
       * hides its own options.
       */
      get filterFacets() {
        return [
          ...new Set([
            ...this.openFacets,
            ...self.defaultColumns,
            ...self.groupingFields,
          ]),
        ]
      },
      /**
       * #getter
       * The facets that start open, listed first: the leading default columns,
       * any column the user showed, and any facet still filtering. The rest
       * start collapsed to their heading, so a hub with many metadata keys
       * offers them all without listing every value of each.
       */
      get openFacets() {
        const active = [...self.filters]
          .filter(([, values]) => values.length > 0)
          .map(([field]) => field)
        return new Set([
          ...self.defaultColumns.slice(0, OPEN_FACETS),
          ...self.chosenColumns.shown.filter(f => f !== 'name'),
          ...active,
        ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Per-facet category counts for the filter sidebar. Cached by MobX so it
       * recomputes only when rows or filters change, not on every render.
       */
      get facetCategoryCounts() {
        return computeFacetCategoryCounts(
          self.rows,
          self.filterFacets,
          self.filters,
        )
      },
      /**
       * #getter
       * Measured pixel widths for every column that can show. Measured over
       * allRows so widths stay stable and don't recompute on every filterText
       * keystroke.
       */
      get initialWidths(): Record<string, number> {
        return Object.fromEntries(
          self.candidateColumns.map(f => [
            f,
            f === 'name'
              ? measureNameColumnWidth(self.allRows)
              : Math.max(
                  measureGridWidth(
                    self.allRows.map(r => getRowStr(f, r)),
                    { maxWidth: 400, stripHTML: true },
                  ),
                  measureGridWidth([facetLabel(f, self.nonMetadataFieldSet)], {
                    fontSize: 14,
                    padding: 46,
                    maxWidth: 400,
                  }),
                ),
          ]),
        )
      },
      /**
       * #getter
       * Faceted rows in display order: filteredRows sorted by the active sort
       * field. With no sort field, a search lists the tracks whose name holds
       * every word first, each group in natural order.
       */
      get sortedRows() {
        const { sortAscending, sortField, filteredRows, filterText } = self
        if (!sortField) {
          const nameMatches = searchMatcher(filterText)
          return nameMatches
            ? [
                ...filteredRows.filter(r => nameMatches(r.nameSearchText)),
                ...filteredRows.filter(r => !nameMatches(r.nameSearchText)),
              ]
            : filteredRows
        }
        const dir = sortAscending ? 1 : -1
        // sort on what the cell displays, not the raw slot: a value wrapped in
        // markup would otherwise sort under '<'. Keys are stripped once per row
        // rather than once per comparison.
        return filteredRows
          .map(row => ({
            row,
            key: coarseStripHTML(getRowStr(sortField, row)),
          }))
          .sort((a, b) => dir * trackNameCollator.compare(a.key, b.key))
          .map(({ row }) => row)
      },
      /**
       * #method
       * The columns to draw when `count` fit beside the name: the leading
       * default columns that fit, plus every column the user showed.
       */
      shownColumns(count: number) {
        const { shown, hidden } = self.chosenColumns
        const auto = self.defaultColumns
          .filter(f => !hidden.has(f) && !shown.includes(f))
          .slice(0, Math.max(0, count - shown.length))
        const keep = new Set([...auto, ...shown])
        return [
          'name',
          ...self.candidateColumns.filter(f => f !== 'name' && keep.has(f)),
        ]
      },
    }))
}
export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
export type FacetedRow = FacetedModel['filteredRows'][0]
