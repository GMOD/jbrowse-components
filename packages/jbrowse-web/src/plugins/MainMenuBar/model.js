import { getRoot, types } from 'mobx-state-tree'
import { ElementId } from '../../mst-types'
import { stringToFunction } from '../../configuration/configurationSchema'

const MenuItemModel = types
  .model('MenuItemModel', {
    name: types.string,
    icon: types.optional(types.string, ''),
    callback: types.optional(
      types.string,
      'function(model){console.log(model)}',
    ),
  })
  .views(self => ({
    get func() {
      const action = this.getAction(self.callback)
      if (action) return action
      return stringToFunction(self.callback)
    },
  }))
  .actions(self => ({
    getAction(action) {
      return this[action]
    },
    openAbout() {
      const rootModel = getRoot(self)
      if (!rootModel.drawerWidgets.get('aboutDrawerWidget'))
        rootModel.addDrawerWidget('AboutDrawerWidget', 'aboutDrawerWidget')
      rootModel.showDrawerWidget(
        rootModel.drawerWidgets.get('aboutDrawerWidget'),
      )
    },
    openHelp() {
      const rootModel = getRoot(self)
      if (!rootModel.drawerWidgets.get('helpDrawerWidget'))
        rootModel.addDrawerWidget('HelpDrawerWidget', 'helpDrawerWidget')
      rootModel.showDrawerWidget(
        rootModel.drawerWidgets.get('helpDrawerWidget'),
      )
    },
  }))

const MenuModel = types
  .model('MenuModel', {
    name: types.string,
    menuItems: types.array(MenuItemModel),
  })
  .actions(self => ({
    addMenuItem({ name, icon = undefined, callback = undefined }) {
      self.menuItems.push(MenuItemModel.create({ name, icon, callback }))
    },
  }))

export const MainMenuBarModel = types
  .model('MainMenuBarModel', {
    id: ElementId,
    type: types.literal('MainMenuBar'),
    menus: types.array(MenuModel),
  })
  .actions(self => ({
    afterCreate() {
      this.addMenu({
        name: 'Help',
        menuItems: [
          { name: 'About', icon: 'info', callback: 'openAbout' },
          { name: 'Help', icon: 'help', callback: 'openHelp' },
        ],
      })
    },
    addMenu({ name, menuItems = [] }) {
      self.menus.push(MenuModel.create({ name, menuItems }))
    },
  }))

export const AboutDrawerWidgetModel = types.model('AboutDrawerWidget', {
  id: ElementId,
  type: types.literal('AboutDrawerWidget'),
})

export const HelpDrawerWidgetModel = types.model('HelpDrawerWidget', {
  id: ElementId,
  type: types.literal('HelpDrawerWidget'),
})
