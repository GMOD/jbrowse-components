import { readConfObject } from '@jbrowse/core/configuration'
import {
  localStorageGetBoolean,
  localStorageGetNumber,
  measureGridWidth,
} from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import { getRowStr } from './components/util.ts'
import { findNonSparseKeys, getRootKeys } from './facetedUtil.ts'
import { measureNameColumnWidth } from '../HierarchicalTrackSelectorWidget/components/shared/trackGridUtils.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

/**
 * #stateModel FacetedModel
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
      showOptions: types.optional(types.boolean, () =>
        localStorageGetBoolean('facet-showTableOptions', false),
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
      },
      /**
       * #action
       */
      setShowOptions(f: boolean) {
        self.showOptions = f
      },
      /**
       * #action
       */
      setShowFilters(f: boolean) {
        self.showFilters = f
      },
      /**
       * #action
       */
      setVisible(args: Record<string, boolean>) {
        self.visible = args
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
        const queryLower = self.filterText.toLowerCase()
        if (!queryLower) {
          return self.allRows
        }
        return self.allRows.filter(
          row =>
            row.name.toLowerCase().includes(queryLower) ||
            row.category?.toLowerCase().includes(queryLower) ||
            row.description?.toLowerCase().includes(queryLower) ||
            Object.values(row.metadata).some(
              v =>
                v !== null &&
                v !== undefined &&
                `${v}`.toLowerCase().includes(queryLower),
            ),
        )
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
       */
      get filteredRows() {
        const arrFilters = [...self.filters.entries()]
          .filter(f => f[1].length > 0)
          .map(([key, val]) => [key, new Set(val)] as const)
        return self.rows.filter(row =>
          arrFilters.every(([key, val]) => val.has(getRowStr(key, row))),
        )
      },
      /**
       * #getter
       * Measured pixel widths for every column. Cached by MobX; recomputes
       * only when rows or the key set change, not on visibility toggles.
       */
      get initialWidths(): Record<string, number> {
        return {
          name: measureNameColumnWidth(self.rows),
          ...Object.fromEntries(
            this.filteredNonMetadataKeys.map(e => [
              e,
              measureGridWidth(
                self.rows.map(r => r[e as keyof typeof r] as string),
                { maxWidth: 400, stripHTML: true },
              ),
            ]),
          ),
          ...Object.fromEntries(
            this.filteredMetadataKeys.map(e => [
              `metadata.${e}`,
              measureGridWidth(
                self.rows.map(r => r.metadata[e]),
                { maxWidth: 400, stripHTML: true },
              ),
            ]),
          ),
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            function facetedVisibleAutorun() {
              self.setVisible(
                Object.fromEntries(self.fields.map(c => [c, true])),
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
