import { types } from 'mobx-state-tree'

const MenuItem = types
  .model('MenuItem', {
    name: types.string,
    icon: types.optional(types.string, ''),
    callback: types.optional(
      types.string,
      'function(model){console.log(model)}',
    ),
  })
  .views(self => ({
    get func() {
      if (/^\s*(?:async )?function\s*\(/.test(self.callback)) {
        // eslint-disable-next-line
          return Function(`"use strict";return (${self.callback})`)()
      }
      throw new Error(
        `Can't parse callback function for menu item "${self.name}"`,
      )
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
