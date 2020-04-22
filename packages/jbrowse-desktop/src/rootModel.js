import { getSnapshot, types } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import JBrowseDesktop from './jbrowseModel'
import sessionModelFactory from './sessionModelFactory'

const { electronBetterIpc = {} } = window
const { ipcRenderer } = electronBetterIpc

export default function RootModel(pluginManager) {
  const Session = sessionModelFactory(pluginManager)
  return types
    .model('Root', {
      jbrowse: JBrowseDesktop(pluginManager, Session),
      session: types.maybe(Session),
      savedSessionNames: types.maybe(types.array(types.string)),
    })
    .volatile(() => ({
      menus: [
        {
          label: 'File',
          menuItems: [
            {
              label: 'New Session',
              icon: 'add',
              onClick: session => {
                session.setDefaultSession()
              },
            },
          ],
        },
      ],
    }))
    .actions(self => ({
      setSavedSessionNames(sessionNames) {
        self.savedSessionNames = sessionNames
      },
      setSession(sessionSnapshot) {
        self.session = sessionSnapshot
      },
      setDefaultSession() {
        self.setSession({
          ...self.jbrowse.defaultSession,
          name: `${self.jbrowse.defaultSession.name} ${new Date(
            Date.now(),
          ).toISOString()}`,
        })
      },
      renameCurrentSession(sessionName) {
        const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
        const oldName = snapshot.name
        snapshot.name = sessionName
        self.setSession(snapshot)
        ipcRenderer.invoke('renameSession', oldName, sessionName)
      },
      duplicateCurrentSession() {
        const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
        let newSnapshotName = `${self.session.name} (copy)`
        if (self.jbrowse.savedSessionNames.includes(newSnapshotName)) {
          let newSnapshotCopyNumber = 2
          do {
            newSnapshotName = `${self.session.name} (copy ${newSnapshotCopyNumber})`
            newSnapshotCopyNumber += 1
          } while (self.jbrowse.savedSessionNames.includes(newSnapshotName))
        }
        snapshot.name = newSnapshotName
        self.setSession(snapshot)
      },
      activateSession(sessionSnapshot) {
        self.setSession(sessionSnapshot)
        if (sessionSnapshot)
          self.setHistory(UndoManager.create({}, { targetStore: self.session }))
        else self.setHistory(undefined)
      },
      setHistory(history) {
        self.history = history
      },
      setMenus(newMenus) {
        self.menus = newMenus
      },
      /**
       * Add a top-level menu
       * @param menuName Name of the menu to insert.
       * @returns The new length of the top-level menus array
       */
      appendMenu(menuName) {
        return self.menus.push({ label: menuName, menuItems: [] })
      },
      /**
       * Insert a top-level menu
       * @param menuName Name of the menu to insert.
       * @param position Position to insert menu. If negative, counts from th
       * end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
       * second-to-last one.
       * @returns The new length of the top-level menus array
       */
      insertMenu(menuName, position) {
        const insertPosition =
          position < 0 ? self.menus.length + position : position
        self.menus.splice(insertPosition, 0, { label: menuName, menuItems: [] })
        return self.menus.length
      },
      /**
       * Add a menu item to a top-level menu
       * @param menuName Name of the top-level menu to append to.
       * @param menuItem Menu item to append.
       * @returns The new length of the menu
       */
      appendToMenu(menuName, menuItem) {
        const menu = self.menus.find(m => m.label === menuName)
        if (!menu) {
          self.menus.push({ label: menuName, menuItems: [menuItem] })
          return 1
        }
        return menu.menuItems.push(menuItem)
      },
      /**
       * Insert a menu item into a top-level menu
       * @param menuName Name of the top-level menu to insert into
       * @param menuItem Menu item to insert
       * @param position Position to insert menu item. If negative, counts from
       * the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
       * second-to-last one.
       * @returns The new length of the menu
       */
      insertInMenu(menuName, menuItem, position) {
        const menu = self.menus.find(m => m.label === menuName)
        if (!menu) {
          self.menus.push({ label: menuName, menuItems: [menuItem] })
          return 1
        }
        const insertPosition =
          position < 0 ? menu.menuItems.length + position : position
        menu.menuItems.splice(insertPosition, 0, menuItem)
        return menu.menuItems.length
      },
      /**
       * Add a menu item to a sub-menu
       * @param menuPath Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       * @param menuItem Menu item to append.
       * @returns The new length of the sub-menu
       */
      appendToSubMenu(menuPath, menuItem) {
        let topMenu = self.menus.find(m => m.label === menuPath[0])
        if (!topMenu) {
          const idx = this.appendMenu(menuPath[0])
          topMenu = self.menus[idx - 1]
        }
        let { menuItems: subMenu } = topMenu
        const pathSoFar = [menuPath[0]]
        menuPath.slice(1).forEach(menuName => {
          pathSoFar.push(menuName)
          let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
          if (!sm) {
            const idx = subMenu.push({ label: menuName, subMenu: [] })
            sm = subMenu[idx - 1]
          }
          if (!('subMenu' in sm)) {
            throw new Error(
              `"${menuName}" in path "${pathSoFar}" is not a subMenu`,
            )
          }
          subMenu = sm.subMenu
        })
        return subMenu.push(menuItem)
      },
      /**
       * Insert a menu item into a sub-menu
       * @param menuPath Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       * @param menuItem Menu item to insert.
       * @param position Position to insert menu item. If negative, counts from
       * the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
       * second-to-last one.
       * @returns The new length of the sub-menu
       */
      insertInSubMenu(menuPath, menuItem, position) {
        let topMenu = self.menus.find(m => m.label === menuPath[0])
        if (!topMenu) {
          const idx = this.appendMenu(menuPath[0])
          topMenu = self.menus[idx - 1]
        }
        let { menuItems: subMenu } = topMenu
        const pathSoFar = [menuPath[0]]
        menuPath.slice(1).forEach(menuName => {
          pathSoFar.push(menuName)
          let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
          if (!sm) {
            const idx = subMenu.push({ label: menuName, subMenu: [] })
            sm = subMenu[idx - 1]
          }
          if (!('subMenu' in sm)) {
            throw new Error(
              `"${menuName}" in path "${pathSoFar}" is not a subMenu`,
            )
          }
          subMenu = sm.subMenu
        })
        subMenu.splice(position, 0, menuItem)
        return subMenu.length
      },
    }))
    .volatile((/* self */) => ({
      history: {},
    }))
}
