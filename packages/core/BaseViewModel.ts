import { types, Instance } from 'mobx-state-tree'
import { ElementId } from './util/types/mst'
import { MenuOption } from './ui'

const BaseViewModel = types
  .model('BaseView', {
    id: ElementId,
    displayName: types.maybe(types.string),
  })
  .volatile((/* self */) => ({
    width: 800,
  }))
  .views((/* self */) => ({
    get menuOptions(): MenuOption[] {
      return []
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
