import { types, Instance } from 'mobx-state-tree'
import { ElementId } from '../../util/types/mst'
import { MenuItem } from '../../ui'
import BaseResult from '../../TextSearch/BaseResults'

const BaseViewModel = types
  .model('BaseView', {
    id: ElementId,
    displayName: types.maybe(types.string),
  })
  .volatile((/* self */) => ({
    width: 800,
  }))
  .views((/* self */) => ({
    menuItems(): MenuItem[] {
      return []
    },
    currentLocation(): string | undefined {
      return undefined
    },
    searchScope(assemblyName: string) {
      return {
        assemblyName,
        includeAggregateIndexes: true,
      }
    },
    rankSearchResults(results: BaseResult[]) {
      return results
    },
  }))
  .actions(self => ({
    setDisplayName(name: string) {
      self.displayName = name
    },
    setWidth(newWidth: number) {
      self.width = newWidth
    },
  }))

export default BaseViewModel
// eslint-disable-next-line @typescript-eslint/no-empty-interface,@typescript-eslint/interface-name-prefix
export interface IBaseViewModel extends Instance<typeof BaseViewModel> {}
