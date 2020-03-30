import { ElementId } from '@gmod/jbrowse-core/mst-types'
import { getSession } from '@gmod/jbrowse-core/util'
import { stringToFunction } from '@gmod/jbrowse-core/util/functionStrings'
import saveAs from 'file-saver'
import { getRoot, getSnapshot, types } from 'mobx-state-tree'

export const MenuItemModel = types
  .model('MenuItemModel', {
    name: types.string,
    icon: types.optional(types.string, ''),
    callback: types.optional(
      types.string,
      'function(model){console.log(model)}',
    ),
  })

  .actions(self => ({
    getAction(action) {
      return this[action]
    },
    openAbout() {
      /** @type any */
      const session = getSession(self)
      const drawerWidget = session.addDrawerWidget(
        'AboutDrawerWidget',
        'aboutDrawerWidget',
      )
      session.showDrawerWidget(drawerWidget)
    },
    openHelp() {
      /** @type any */
      const session = getSession(self)
      const drawerWidget = session.addDrawerWidget(
        'HelpDrawerWidget',
        'helpDrawerWidget',
      )
      session.showDrawerWidget(drawerWidget)
    },
    openConfigurationImport() {
      /** @type any */
      const session = getSession(self)
      const drawerWidget = session.addDrawerWidget(
        'ImportConfigurationDrawerWidget',
        'importConfigurationDrawerWidget',
      )
      session.showDrawerWidget(drawerWidget)
    },
    exportConfiguration() {
      const configuration = getRoot(self)
      const initialSnap = JSON.stringify(getSnapshot(configuration))
      const filter = (key, value) => {
        if (key === 'id') {
          const re = new RegExp(`"${value}"`, 'g')
          if ((initialSnap.match(re) || []).length < 2) return undefined
        }
        return value
      }
      const configSnap = JSON.stringify(
        getSnapshot(configuration),
        filter,
        '  ',
      )
      saveAs(new Blob([configSnap]), 'jbrowse_configuration.json')
      return configSnap
    },
    importConfiguration() {
      this.openConfigurationImport()
    },
  }))
  .views(self => ({
    get func() {
      const action = self.getAction(self.callback)
      if (action) return action
      return stringToFunction(self.callback)
    },
  }))

export const MenuDividerModel = types.model('MenuDividerModel', {
  name: types.literal('divider'),
})

const MenuModel = types
  .model('MenuModel', {
    name: types.string,
    menuItems: types.array(types.union(MenuItemModel, MenuDividerModel)),
  })
  .actions(self => ({
    addMenuItem({ name, icon = undefined, callback = undefined }) {
      self.menuItems.push(MenuItemModel.create({ name, icon, callback }))
    },
  }))

export default types
  .model('MainMenuBarModel', {
    id: ElementId,
    type: types.literal('MainMenuBar'),
    menus: types.array(MenuModel),
  })
  .actions(self => ({
    afterCreate() {
      if (!self.menus.find(menu => menu.name === 'Help'))
        this.pushMenu({
          name: 'Help',
          menuItems: [
            { name: 'About', icon: 'info', callback: 'openAbout' },
            { name: 'Help', icon: 'help', callback: 'openHelp' },
          ],
        })
      if (!self.menus.find(menu => menu.name === 'File'))
        this.unshiftMenu({
          name: 'File',
          menuItems: [
            {
              name: 'New Session',
              icon: 'add',
              callback: 'function(session) {session.setDefaultSession();}',
            },
            {
              name: 'Open Session...',
              icon: 'folder_open',
              callback:
                "function(session) {const drawerWidget = session.addDrawerWidget('SessionManager','sessionManager',);session.showDrawerWidget(drawerWidget);}",
            },
            {
              name: 'Duplicate Session',
              icon: 'file_copy',
              callback:
                'function(session) {session.duplicateCurrentSession();}',
            },
            {
              name: 'New linear genome view',
              icon: 'line_style',
              callback:
                "function(session) { session.addView('LinearGenomeView', {})}",
            },
            {
              name: 'New circular view',
              icon: 'data_usage',
              callback:
                "function(session) { session.addView('CircularView', {})}",
            },
            {
              name: 'New SV inspector',
              icon: 'table_chart',
              callback:
                "function(session) { session.addView('SvInspectorView', {})}",
            },
            {
              name: 'Open tabular data',
              icon: 'view_comfy',
              callback:
                "function(session) { session.addView('SpreadsheetView', {})}",
            },
            {
              name: 'Open new track',
              icon: 'note_add',
              callback: `function(session) {
const drawerWidget = session.addDrawerWidget(
      'AddTrackDrawerWidget',
      'addTrackDrawerWidget',
    )
    session.showDrawerWidget(drawerWidget)`,
            },
            {
              name: 'Open new connection',
              icon: 'input',
              callback: `function(session) {
const drawerWidget = session.addDrawerWidget(
      'AddConnectionDrawerWidget',
      'addConnectionDrawerWidget',
    )
    session.showDrawerWidget(drawerWidget)`,
            },
          ],
        })
    },
    unshiftMenu({ name, menuItems = [] }) {
      self.menus.unshift({ name, menuItems })
    },
    pushMenu({ name, menuItems = [] }) {
      self.menus.push({ name, menuItems })
    },
  }))
