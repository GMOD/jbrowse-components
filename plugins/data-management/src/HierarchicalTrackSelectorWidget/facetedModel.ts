import { Instance, addDisposer, getParent, types } from 'mobx-state-tree'
import { matches } from './util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import {
  getSession,
  localStorageGetItem,
  measureGridWidth,
} from '@jbrowse/core/util'
import { autorun, observable } from 'mobx'
import { getRootKeys, findNonSparseKeys } from './facetedUtil'
import { getRowStr } from './components/faceted/util'

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
      panelWidth: types.optional(types.number, () =>
        JSON.parse(localStorageGetItem('facet-panelWidth') || '400'),
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
      showSparse: types.optional(types.boolean, () =>
        JSON.parse(localStorageGetItem('facet-showSparse') || 'false'),
      ),
    })
    .volatile(() => ({
      filters: observable.map<string, string[]>(),
      useShoppingCart: false,
      visible: {} as Record<string, boolean>,
      widths: {} as Record<string, number | undefined>,
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
      setFilterText(str: string) {
        self.filterText = str
      },

      /**
       * #action
       */
      setPanelWidth(width: number) {
        self.panelWidth = width
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
      setShowOptions(f: boolean) {
        self.showOptions = f
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
      setUseShoppingCart(f: boolean) {
        self.useShoppingCart = f
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
              adapter: readConfObject(track, 'adapter')?.type as string,
              category: readConfObject(track, 'category')?.join(', ') as string,
              conf: track,
              description: readConfObject(track, 'description') as string,
              id: track.trackId as string,
              metadata: readConfObject(track, 'metadata') as Record<
                string,
                unknown
              >,
              name: getTrackName(track, session),
            } as const
          })
      },
    }))

    .views(self => ({
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
      get filteredNonMetadataKeys() {
        return self.showSparse
          ? nonMetadataKeys
          : findNonSparseKeys(nonMetadataKeys, self.rows, (r, f) => r[f])
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
       */
      get metadataKeys() {
        return [...new Set(self.rows.flatMap(row => getRootKeys(row.metadata)))]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            this.setVisible(Object.fromEntries(self.fields.map(c => [c, true])))
          }),
        )

        addDisposer(
          self,
          autorun(() => {
            this.setWidths({
              name:
                measureGridWidth(
                  self.rows.map(r => r.name),
                  { maxWidth: 500, stripHTML: true },
                ) + 15,
              ...Object.fromEntries(
                self.filteredNonMetadataKeys
                  .filter(f => self.visible[f])
                  .map(e => [
                    e,
                    measureGridWidth(
                      self.rows.map(r => r[e as keyof typeof r] as string),
                      { maxWidth: 400, stripHTML: true },
                    ),
                  ]),
              ),
              ...Object.fromEntries(
                self.filteredMetadataKeys
                  .filter(f => self.visible['metadata.' + f])
                  .map(e => {
                    return [
                      'metadata.' + e,
                      measureGridWidth(
                        self.rows.map(r => r.metadata[e]),
                        { maxWidth: 400, stripHTML: true },
                      ),
                    ]
                  }),
              ),
            })
          }),
        )
      },

      /**
       * #action
       */
      setVisible(args: Record<string, boolean>) {
        self.visible = args
      },
      /**
       * #action
       */
      setWidths(args: Record<string, number | undefined>) {
        self.widths = args
      },
    }))
}

export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
