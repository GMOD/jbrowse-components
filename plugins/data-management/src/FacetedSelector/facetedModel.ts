import { readConfObject } from '@jbrowse/core/configuration'
import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageGetNumber,
  localStorageSetBoolean,
  localStorageSetItem,
  measureGridWidth,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import {
  computeFacetCategoryCounts,
  filterRowsByFacets,
  filterRowsByText,
} from './facetedFilter.ts'
import { findNonSparseKeys, getRootKeys } from './facetedUtil.ts'
import { measureNameColumnWidth } from '../HierarchicalTrackSelectorWidget/components/shared/trackGridUtils.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

const hiddenColumnsKey = 'facet-hiddenColumns'

// Column names the user has hidden, persisted across sessions. Tolerant of a
// corrupt/missing entry (falls back to none hidden).
function readHiddenColumns(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorageGetItem(hiddenColumnsKey) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : []
  } catch (e) {
    console.error(e)
    return []
  }
}

/**
 * #stateModel FacetedModel
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
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      visible: {} as Record<string, boolean>,
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
      ) {
        self.trackConfigurations = tracks
        self.session = session
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
      setPanelWidth(width: number) {
        self.panelWidth = width
        localStorageSetItem('facet-panelWidth', JSON.stringify(width))
        return self.panelWidth
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
      setVisible(args: Record<string, boolean>) {
        self.visible = args
        localStorageSetItem(
          hiddenColumnsKey,
          JSON.stringify(Object.keys(args).filter(k => !args[k])),
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
        if (!session) {
          return []
        }
        return self.trackConfigurations.map(
          track =>
            ({
              id: track.trackId as string,
              conf: track,
              name: getTrackName(track, session),
              category: readConfObject(track, 'category')?.join(', '),
              adapter: (track.adapter as { type?: string } | undefined)?.type,
              description: readConfObject(track, 'description') as
                | string
                | undefined,
              metadata: (readConfObject(track, 'metadata') ?? {}) as Record<
                string,
                unknown
              >,
            }) as const,
        )
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
      get filteredNonMetadataKeys() {
        return self.showSparse
          ? nonMetadataKeys
          : findNonSparseKeys(
              nonMetadataKeys,
              self.allRows,
              (r, f) => r[f as keyof typeof r],
            )
      },
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
       */
      get filteredMetadataKeys() {
        return self.showSparse
          ? this.metadataKeys
          : findNonSparseKeys(
              this.metadataKeys,
              self.allRows,
              (r, f) => r.metadata[f],
            )
      },
      /**
       * #getter
       */
      get fields() {
        return [
          'name',
          ...this.filteredNonMetadataKeys,
          ...this.filteredMetadataKeys.map(m => `metadata.${m}`),
        ]
      },
      /**
       * #getter
       * Used to detect when a metadata key collides with a non-metadata column
       * name (so the header can show "x (from metadata)").
       */
      get nonMetadataFieldSet() {
        return new Set(['name', ...this.filteredNonMetadataKeys])
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
          this.fields.slice(1),
          self.filters,
        )
      },
      /**
       * #getter
       * Measured pixel widths for every column. Measured over allRows so widths
       * stay stable and don't recompute on every filterText keystroke.
       */
      get initialWidths(): Record<string, number> {
        return {
          name: measureNameColumnWidth(self.allRows),
          ...Object.fromEntries(
            this.filteredNonMetadataKeys.map(e => [
              e,
              measureGridWidth(
                self.allRows.map(r => r[e as keyof typeof r] as string),
                { maxWidth: 400, stripHTML: true },
              ),
            ]),
          ),
          ...Object.fromEntries(
            this.filteredMetadataKeys.map(e => [
              `metadata.${e}`,
              measureGridWidth(
                self.allRows.map(r => r.metadata[e]),
                { maxWidth: 400, stripHTML: true },
              ),
            ]),
          ),
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        const hidden = new Set(readHiddenColumns())
        addDisposer(
          self,
          autorun(
            function facetedVisibleAutorun() {
              // Preserve this session's visibility choices for columns that
              // still exist; a newly-introduced column defaults to hidden if it
              // was hidden in a previous session, otherwise visible.
              self.setVisible(
                Object.fromEntries(
                  self.fields.map(c => [c, self.visible[c] ?? !hidden.has(c)]),
                ),
              )
            },
            { name: 'FacetedVisible' },
          ),
        )
      },
    }))
}
export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
export type FacetedRow = FacetedModel['filteredRows'][0]
