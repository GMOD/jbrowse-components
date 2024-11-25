import { readConfObject } from '@jbrowse/core/configuration'
import { getSession, localStorageGetItem } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { autorun, observable } from 'mobx'
import { addDisposer, getParent, types } from 'mobx-state-tree'
import { getRowStr } from './components/faceted/util'
import { getRootKeys, findNonSparseKeys } from './facetedUtil'
import { matches } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Instance } from 'mobx-state-tree'

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
        JSON.parse(localStorageGetItem('facet-showSparse') || 'false'),
      ),
      /**
       * #property
       */
      showFilters: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showFilters') || 'true'),
      ),

      /**
       * #property
       */
      showOptions: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showTableOptions') || 'false'),
      ),

      /**
       * #property
       */
      panelWidth: types.optional(types.number, () =>
        JSON.parse(localStorageGetItem('facet-panelWidth') || '400'),
      ),
    })
    .volatile(() => ({
      visible: {} as Record<string, boolean>,
      useShoppingCart: false,
      filters: observable.map<string, string[]>(),
    }))
    .actions(self => ({
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
    }))
    .views(self => ({
      /**
       * #getter
       */
      get allTrackConfigurations() {
        return getParent<{ allTrackConfigurations: AnyConfigurationModel[] }>(
          self,
        ).allTrackConfigurations
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rows() {
        const session = getSession(self)
        const { allTrackConfigurations, filterText } = self
        return allTrackConfigurations
          .filter(conf => matches(filterText, conf, session))
          .map(track => {
            return {
              id: track.trackId as string,
              conf: track,
              name: getTrackName(track, session),
              category: readConfObject(track, 'category')?.join(', ') as string,
              adapter: readConfObject(track, 'adapter')?.type as string,
              description: readConfObject(track, 'description') as string,
              metadata: readConfObject(track, 'metadata') as Record<
                string,
                unknown
              >,
            } as const
          })
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get filteredNonMetadataKeys() {
        return self.showSparse
          ? nonMetadataKeys
          : findNonSparseKeys(nonMetadataKeys, self.rows, (r, f) => r[f])
      },
      /**
       * #getter
       */
      get metadataKeys() {
        return [...new Set(self.rows.flatMap(row => getRootKeys(row.metadata)))]
      },
      get filteredMetadataKeys() {
        return self.showSparse
          ? this.metadataKeys
          : findNonSparseKeys(
              this.metadataKeys,
              self.rows,
              // @ts-expect-error
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
    }))
    .actions(self => ({
      /**
       * #action
       */
      setVisible(args: Record<string, boolean>) {
        self.visible = args
      },

      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            this.setVisible(Object.fromEntries(self.fields.map(c => [c, true])))
          }),
        )
      },
    }))
}

export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
