import { readConfObject } from '@jbrowse/core/configuration'
import {
  coarseStripHTML,
  localStorageGetBoolean,
  localStorageGetNumber,
  localStorageGetStringArray,
  localStorageSetBoolean,
  localStorageSetJSON,
  localStorageSetNumber,
  measureGridWidth,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { trackNameCollator } from '../shared/collator.ts'
import { configScopedKey } from '../shared/configScopedKey.ts'
import { measureNameColumnWidth } from '../shared/trackGridUtils.ts'
import { getRowStr, isMetadataFacet, metadataFacet } from './components/util.ts'
import {
  computeFacetCategoryCounts,
  filterRowsByFacets,
  filterRowsByText,
  rowSearchText,
} from './facetedFilter.ts'
import { findNonSparseKeys, getRootKeys } from './facetedUtil.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackCatalog } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

// smallest useful width for either of the two panes, applied to the filter
// panel when dragging its handle and to the data pane when laying out
export const MIN_PANEL_WIDTH = 100

// Hidden columns are config+assembly scoped: the metadata columns differ per
// dataset, so hiding one shouldn't carry over to an unrelated config.
function hiddenColumnsKey(assemblyNames: string[]) {
  return configScopedKey('facet-hiddenColumns', assemblyNames)
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
      showSparse: types.optional(types.boolean, () =>
        localStorageGetBoolean('facet-showSparse', false),
      ),
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
        localStorageGetNumber('facet-panelWidth', 400),
      ),
      /**
       * #property
       * Column names the user has hidden. Loaded from a config+assembly scoped
       * localStorage entry in setTrackSource (once assemblies are known).
       */
      hiddenColumns: types.optional(types.array(types.string), []),
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
      getTracks: (() => []) as () => AnyConfigurationModel[],
      /**
       * #volatile
       */
      session: undefined as TrackCatalog | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setTrackSource(
        getTracks: () => AnyConfigurationModel[],
        session: TrackCatalog,
        assemblyNames: string[],
      ) {
        self.getTracks = getTracks
        self.session = session
        self.assemblyNames = assemblyNames
        // a string list, not a raw JSON read: an entry of the wrong element
        // type parses fine and then hides nothing while looking like it hid
        // something
        self.hiddenColumns.replace(
          localStorageGetStringArray(hiddenColumnsKey(assemblyNames)),
        )
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
      setShowSparse(f: boolean) {
        self.showSparse = f
        localStorageSetBoolean('facet-showSparse', f)
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
       */
      setColumnVisible(field: string, visible: boolean) {
        const next = visible
          ? self.hiddenColumns.filter(c => c !== field)
          : [...new Set([...self.hiddenColumns, field])]
        self.hiddenColumns.replace(next)
        localStorageSetJSON(hiddenColumnsKey(self.assemblyNames), next)
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
              const row = {
                id: track.trackId as string,
                conf: track,
                name: getTrackName(track, session),
                category: readConfObject(track, 'category')?.join(', ') as
                  | string
                  | undefined,
                adapter: (track.adapter as { type?: string } | undefined)?.type,
                description: readConfObject(track, 'description') as
                  | string
                  | undefined,
                metadata: (readConfObject(track, 'metadata') ?? {}) as Record<
                  string,
                  unknown
                >,
              }
              return { ...row, searchText: rowSearchText(row) } as const
            })
          : []
      },
    }))
    .views(self => ({
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
          ...new Set(self.allRows.flatMap(row => getRootKeys(row.metadata))),
        ]
      },
      /**
       * #getter
       * Facet field ids in column order (non-metadata first, then
       * `metadata.<key>`); both kinds resolve through getRowStr. Sparse fields
       * are dropped unless showSparse.
       */
      get facetFields() {
        const candidates = [
          ...nonMetadataKeys,
          ...this.metadataKeys.map(metadataFacet),
        ]
        return self.showSparse
          ? candidates
          : findNonSparseKeys(candidates, self.allRows, (r, f) =>
              getRowStr(f, r),
            )
      },
      /**
       * #getter
       */
      get fields() {
        return ['name', ...this.facetFields]
      },
      /**
       * #getter
       * The non-metadata field names, used to detect when a metadata key
       * collides with one (so the header can show "x (from metadata)").
       */
      get nonMetadataFieldSet() {
        return new Set([
          'name',
          ...this.facetFields.filter(f => !isMetadataFacet(f)),
        ])
      },
      /**
       * #getter
       * Per-field visibility derived from the persisted hiddenColumns list. A
       * field absent from the list (e.g. newly introduced) defaults to visible.
       */
      get visible(): Record<string, boolean> {
        const hidden = new Set(self.hiddenColumns)
        return Object.fromEntries(this.fields.map(f => [f, !hidden.has(f)]))
      },
      /**
       * #getter
       */
      get filteredRows() {
        return filterRowsByFacets(self.rows, self.filters)
      },
      /**
       * #getter
       * Per-facet category counts for the filter sidebar. Cached by MobX so it
       * recomputes only when rows or filters change, not on every render.
       */
      get facetCategoryCounts() {
        return computeFacetCategoryCounts(
          self.rows,
          this.facetFields,
          self.filters,
        )
      },
      /**
       * #getter
       * Measured pixel widths for every column. Measured over allRows so widths
       * stay stable and don't recompute on every filterText keystroke.
       */
      get initialWidths(): Record<string, number> {
        return Object.fromEntries(
          this.fields.map(f => [
            f,
            f === 'name'
              ? measureNameColumnWidth(self.allRows)
              : measureGridWidth(
                  self.allRows.map(r => getRowStr(f, r)),
                  { maxWidth: 400, stripHTML: true },
                ),
          ]),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Faceted rows in display order: filteredRows sorted by the active sort
       * field (natural order when no field is selected).
       */
      get sortedRows() {
        const { sortAscending, filteredRows } = self
        // a sort on a column that is no longer shown (hidden via Manage
        // columns, or dropped out of the fields when showSparse turned off) has
        // no header indicator, so fall back to natural order
        const sortField = self.visible[self.sortField] ? self.sortField : ''
        if (!sortField) {
          return filteredRows
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
    }))
}
export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
export type FacetedRow = FacetedModel['filteredRows'][0]
