import { Instance, getParent, types } from 'mobx-state-tree'
import { matches } from './util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSession, localStorageGetItem } from '@jbrowse/core/util'
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
      showSparse: types.optional(
        types.boolean,
        JSON.parse(localStorageGetItem('facet-showSparse') || 'false'),
      ),
      /**
       * #property
       */
      showFilters: types.optional(
        types.boolean,
        JSON.parse(localStorageGetItem('facet-showFilters') || 'true'),
      ),

      /**
       * #property
       */
      showOptions: types.optional(
        types.boolean,
        JSON.parse(localStorageGetItem('facet-showTableOptions') || 'false'),
      ),

      /**
       * #property
       */
      panelWidth: types.optional(
        types.number,
        JSON.parse(localStorageGetItem('facet-panelWidth') || '400'),
      ),
    })
    .volatile(() => ({
      useShoppingCart: false,
    }))
    .actions(self => ({
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
              id: track.trackId,
              conf: track,
              name: getTrackName(track, session),
              category: readConfObject(track, 'category')?.join(', '),
              adapter: readConfObject(track, 'adapter')?.type,
              description: readConfObject(track, 'description'),
              metadata,
              ...metadata,
            }
          })
      },
    }))
}

export type FacetedStateModel = ReturnType<typeof facetedStateTreeF>
export type FacetedModel = Instance<FacetedStateModel>
