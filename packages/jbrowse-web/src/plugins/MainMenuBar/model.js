import saveAs from 'file-saver'
import { getRoot, types, getSnapshot } from 'mobx-state-tree'
import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { stringToFunction } from '@gmod/jbrowse-core/util/functionStrings'

export const MenuItemModel = types
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
    openConfigurationImport() {
      const rootModel = getRoot(self)
      if (!rootModel.drawerWidgets.get('importConfigurationDrawerWidget'))
        rootModel.addDrawerWidget(
          'ImportConfigurationDrawerWidget',
          'importConfigurationDrawerWidget',
        )
      rootModel.showDrawerWidget(
        rootModel.drawerWidgets.get('importConfigurationDrawerWidget'),
      )
    },
    exportConfiguration() {
      const rootModel = getRoot(self)
      const initialSnap = JSON.stringify(getSnapshot(rootModel.configuration))
      const filter = (key, value) => {
        if (key === 'configId' || key === 'id') {
          const re = new RegExp(`"${value}"`, 'g')
          if ((initialSnap.match(re) || []).length < 2) return undefined
        }
        return value
      }
      const configSnap = JSON.stringify(
        getSnapshot(rootModel.configuration),
        filter,
        '  ',
      )
      saveAs(new Blob([configSnap]), 'jbrowse_configuration.json')
      return configSnap
    },
    importConfiguration() {
      self.openConfigurationImport()
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
      self.pushMenu({
        name: 'Help',
        menuItems: [
          { name: 'About', icon: 'info', callback: 'openAbout' },
          { name: 'Help', icon: 'help', callback: 'openHelp' },
        ],
      })
    },
    unshiftMenu({ name, menuItems = [] }) {
      self.menus.unshift(MenuModel.create({ name, menuItems }))
    },
    pushMenu({ name, menuItems = [] }) {
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

export const AssemblyEditorDrawerWidgetModel = types.model(
  'AssemblyEditorDrawerWidget',
  {
    id: ElementId,
    type: types.literal('AssemblyEditorDrawerWidget'),
  },
)

export const ImportConfigurationDrawerWidgetModel = types.model(
  'ImportConfigurationDrawerWidget',
  {
    id: ElementId,
    type: types.literal('ImportConfigurationDrawerWidget'),
  },
)
