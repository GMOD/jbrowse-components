import { types } from 'mobx-state-tree'
import { stringToFunction } from '../../util/configuration'

const MenuItem = types
  .model('MenuItem', {
    name: types.string,
    icon: types.optional(types.string, ''),
    callback: types.string,
  })
  .views(self => ({
    get func() {
      return stringToFunction(self.callback)
    },
  }))

const MenuModel = types
  .model('MenuModel', {
    name: types.string,
    menuItems: types.array(MenuItem),
  })
  .actions(self => ({
    addMenuItem({ name, icon = '' }) {
      self.menuItems.push(MenuItem.create({ name, icon }))
    },
  }))

export default MenuModel
