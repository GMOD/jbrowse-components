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
import { getRootKeys } from './components/faceted/util'

const nonMetadataKeys = ['category', 'adapter', 'description'] as const

function filt(
  keys: readonly string[],
  rows: Record<string, unknown>[],
  cb: (row: Record<string, unknown>, f: string) => unknown,
) {
  return keys.filter(f => rows.map(r => cb(r, f)).filter(f => !!f).length > 5)
}

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
      widths: {} as Record<string, number | undefined>,
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
      get trackConfigurations() {
        return getParent<{ trackConfigurations: AnyConfigurationModel[] }>(self)
          .trackConfigurations
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rows() {
        const session = getSession(self)
        const { trackConfigurations, filterText } = self
        // metadata is spread onto the object for easier access and sorting
        // by the mui data grid (it's unable to sort by nested objects)
        return trackConfigurations
          .filter(conf => matches(filterText, conf, session))
          .map(track => {
            const metadata = readConfObject(track, 'metadata')
            return {
              id: track.trackId as string,
              conf: track,
              name: getTrackName(track, session),
              category: readConfObject(track, 'category')?.join(', ') as string,
              adapter: readConfObject(track, 'adapter')?.type as string,
              description: readConfObject(track, 'description') as string,
              metadata,
            } as const
          })
      },
    }))

    .views(self => ({
      get filteredNonMetadataKeys() {
        return self.showSparse
          ? nonMetadataKeys
          : filt(nonMetadataKeys, self.rows, (r, f) => r[f])
      },

      get metadataKeys() {
        return [...new Set(self.rows.flatMap(row => getRootKeys(row.metadata)))]
      },
      get filteredMetadataKeys() {
        return self.showSparse
          ? this.metadataKeys
          : // @ts-expect-error
            filt(this.metadataKeys, self.rows, (r, f) => r.metadata[f])
      },

      get fields() {
        return [
          'name',
          ...this.filteredNonMetadataKeys,
          ...this.filteredMetadataKeys.map(m => `metadata.${m}`),
        ]
      },
      get filteredRows() {
        const arrFilters = [...self.filters.entries()]
          .filter(f => f[1].length > 0)
          .map(([key, val]) => [key, new Set(val)] as const)
        return self.rows.filter(row =>
          // @ts-expect-error
          arrFilters.every(([key, val]) => val.has(row[key])),
        )
      },
    }))
    .actions(self => ({
      setVisible(args: Record<string, boolean>) {
        self.visible = args
      },
      setWidths(args: Record<string, number | undefined>) {
        self.widths = args
      },
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
    }))
}

export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
