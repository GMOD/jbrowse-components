import shortid from 'shortid'
import { types } from 'mobx-state-tree'
import MenuModel from './menuModel'

const AppBarModel = types
  .model('AppBarModel', {
    id: types.optional(types.identifier, shortid.generate),
    type: types.literal('appbar'),
    menus: types.array(MenuModel),
  })
  .actions(self => ({
    addMenu({ name, menuItems }) {
      self.menus.push(MenuModel.create({ name, menuItems }))
    },
  }))

export default AppBarModel
