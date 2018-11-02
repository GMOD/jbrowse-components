import { types } from 'mobx-state-tree'
import MenuModel from './menuModel'

const AppBarModel = types
  .model('AppBarModel', {
    menus: types.array(MenuModel),
  })
  .actions(self => ({
    addMenu({ name, menuItems }) {
      self.menus.push(MenuModel.create({ name, menuItems }))
    },
  }))

export default AppBarModel
