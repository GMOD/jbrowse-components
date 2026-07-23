import { readConfObject } from '@jbrowse/core/configuration'
import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetNumber,
  localStorageSetBoolean,
  localStorageSetItem,
  localStorageSetNumber,
  measureGridWidth,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { measureNameColumnWidth } from '../HierarchicalTrackSelectorWidget/components/shared/trackGridUtils.ts'
import { configScopedKey } from '../shared/configScopedKey.ts'
import { getRowStr, isMetadataFacet, metadataFacet } from './components/util.ts'
import {
  computeFacetCategoryCounts,
  filterRowsByFacets,
  filterRowsByText,
} from './facetedFilter.ts'
import { findNonSparseKeys, getRootKeys } from './facetedUtil.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

// Hidden columns are config+assembly scoped: the metadata columns differ per
// dataset, so hiding one shouldn't carry over to an unrelated config.
function hiddenColumnsKey(assemblyNames: string[]) {
  return configScopedKey('facet-hiddenColumns', assemblyNames)
}

// Tolerant of a corrupt/missing entry (falls back to none hidden).
function readHiddenColumns(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorageGetItem(key) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter(x => typeof x === 'string')
      : []
  } catch (e) {
    console.error(e)
    return []
  }
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
       * localStorage entry in setTrackConfigurations (once assemblies are known).
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
       */
      trackConfigurations: [] as AnyConfigurationModel[],
      /**
       * #volatile
       */
      session: undefined as AbstractSessionModel | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setTrackConfigurations(
        tracks: AnyConfigurationModel[],
        session: AbstractSessionModel,
        assemblyNames: string[],
      ) {
        self.trackConfigurations = tracks
        self.session = session
        self.assemblyNames = assemblyNames
        self.hiddenColumns.replace(
          readHiddenColumns(hiddenColumnsKey(assemblyNames)),
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
        self.panelWidth = width
        localStorageSetNumber('facet-panelWidth', width)
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
        localStorageSetItem(
          hiddenColumnsKey(self.assemblyNames),
          JSON.stringify(next),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Builds row objects from track configs. Cached and only recomputes when
       * track configurations change, not on every filterText keystroke.
       */
      get allRows() {
        const session = self.session
        return session
          ? self.trackConfigurations.map(
              track =>
                ({
                  id: track.trackId as string,
                  conf: track,
                  name: getTrackName(track, session),
                  category: readConfObject(track, 'category')?.join(', '),
                  adapter: (track.adapter as { type?: string } | undefined)
                    ?.type,
                  description: readConfObject(track, 'description') as
                    | string
                    | undefined,
                  metadata: (readConfObject(track, 'metadata') ?? {}) as Record<
                    string,
                    unknown
                  >,
                }) as const,
            )
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
        const { sortField, sortAscending, filteredRows } = self
        if (!sortField) {
          return filteredRows
        }
        const dir = sortAscending ? 1 : -1
        return [...filteredRows].sort(
          (a, b) =>
            dir *
            getRowStr(sortField, a).localeCompare(
              getRowStr(sortField, b),
              undefined,
              { numeric: true },
            ),
        )
      },
    }))
}
export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
export type FacetedRow = FacetedModel['filteredRows'][0]
