import assemblyManagerFactory, {
  assemblyConfigSchemas as AssemblyConfigSchemasFactory,
} from '@gmod/jbrowse-core/assemblyManager'
import queryString from 'query-string'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { MenuOption } from '@gmod/jbrowse-core/ui'
import { toUrlSafeB64, AbstractSessionModel } from '@gmod/jbrowse-core/util'
import { getConf } from '@gmod/jbrowse-core/configuration'
import {
  addDisposer,
  cast,
  getSnapshot,
  SnapshotIn,
  types,
} from 'mobx-state-tree'
import { autorun } from 'mobx'
import { UndoManager } from 'mst-middlewares'
import corePlugins from './corePlugins'
import jbrowseWebFactory from './jbrowseModel'
// @ts-ignore
import RenderWorker from './rpc.worker'
import sessionModelFactory from './sessionModelFactory'

interface Menu {
  label: string
  menuItems: MenuOption[]
}

const MAX_SESSION_SIZE_IN_URL = 100000

export default function RootModel(pluginManager: PluginManager) {
  const Session = sessionModelFactory(pluginManager)
  const { assemblyConfigSchemas, dispatcher } = AssemblyConfigSchemasFactory(
    pluginManager,
  )
  const assemblyConfigSchemasType = types.union(
    { dispatcher },
    ...assemblyConfigSchemas,
  )
  const assemblyManagerType = assemblyManagerFactory(assemblyConfigSchemasType)
  return types
    .model('Root', {
      jbrowse: jbrowseWebFactory(
        pluginManager,
        Session,
        assemblyConfigSchemasType,
      ),
      session: types.maybe(Session),
      assemblyManager: assemblyManagerType,
      error: types.maybe(types.string),
    })
    .actions(self => ({
      setSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
        self.jbrowse.updateSavedSession(sessionSnapshot)
      },
      setDefaultSession() {
        this.setSession({
          ...self.jbrowse.defaultSession,
          name: `${self.jbrowse.defaultSession.name} ${new Date(
            Date.now(),
          ).toISOString()}`,
        })
      },
      renameCurrentSession(sessionName: string) {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          const oldName = snapshot.name
          snapshot.name = sessionName
          self.jbrowse.replaceSavedSession(oldName, snapshot)
          this.setSession(snapshot)
        }
      },
      duplicateCurrentSession() {
        if (self.session) {
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
          this.setSession(snapshot)
        }
      },
      activateSession(name: string) {
        const newSessionSnapshot = self.jbrowse.savedSessions.find(
          sessionSnap => sessionSnap.name === name,
        )
        if (!newSessionSnapshot)
          throw new Error(
            `Can't activate session ${name}, it is not in the savedSessions`,
          )
        this.setSession(newSessionSnapshot)
      },
      setError(errorMessage: string) {
        self.error = errorMessage
      },
    }))
    .volatile(self => ({
      history: {},
      menus: [
        {
          label: 'File',
          menuItems: [
            {
              label: 'New Session',
              icon: 'add',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick: (session: any) => {
                session.setDefaultSession()
              },
            },
          ],
        },
      ] as Menu[],
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { WorkerClass: RenderWorker },
          MainThreadRpcDriver: {},
        },
      ),
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            () => {
              if (self.session) {
                const snapshot = JSON.stringify(getSnapshot(self.session))
                if (getConf(self.jbrowse, 'useLocalStorage')) {
                  localStorage.setItem('jbrowse-web-session', snapshot)
                }
                if (getConf(self.jbrowse, 'updateUrl')) {
                  const parsed = queryString.parse(document.location.search)
                  const urlSplit = window.location.href.split('?')
                  if (snapshot.length < MAX_SESSION_SIZE_IN_URL) {
                    parsed.session = toUrlSafeB64(snapshot)
                  } else {
                    parsed.session = undefined
                  }
                  window.history.replaceState(
                    {},
                    '',
                    `${urlSplit[0]}?${queryString.stringify(parsed)}`,
                  )
                }
              }
            },
            { delay: 400 },
          ),
        )
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory(history: any) {
        self.history = history
      },
      setMenus(newMenus: Menu[]) {
        self.menus = newMenus
      },
      /**
       * Add a top-level menu
       * @param menuName - Name of the menu to insert.
       * @returns The new length of the top-level menus array
       */
      appendMenu(menuName: string) {
        return self.menus.push({ label: menuName, menuItems: [] })
      },
      /**
       * Insert a top-level menu
       * @param menuName - Name of the menu to insert.
       * @param position - Position to insert menu. If negative, counts from th
       * end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
       * second-to-last one.
       * @returns The new length of the top-level menus array
       */
      insertMenu(menuName: string, position: number) {
        const insertPosition =
          position < 0 ? self.menus.length + position : position
        self.menus.splice(insertPosition, 0, { label: menuName, menuItems: [] })
        return self.menus.length
      },
      /**
       * Add a menu item to a top-level menu
       * @param menuName - Name of the top-level menu to append to.
       * @param menuItem - Menu item to append.
       * @returns The new length of the menu
       */
      appendToMenu(menuName: string, menuItem: MenuOption) {
        const menu = self.menus.find(m => m.label === menuName)
        if (!menu) {
          self.menus.push({ label: menuName, menuItems: [menuItem] })
          return 1
        }
        return menu.menuItems.push(menuItem)
      },
      /**
       * Insert a menu item into a top-level menu
       * @param menuName - Name of the top-level menu to insert into
       * @param menuItem - Menu item to insert
       * @param position - Position to insert menu item. If negative, counts
       * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
       * the second-to-last one.
       * @returns The new length of the menu
       */
      insertInMenu(menuName: string, menuItem: MenuOption, position: number) {
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
       * @param menuPath - Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       * @param menuItem - Menu item to append.
       * @returns The new length of the sub-menu
       */
      appendToSubMenu(menuPath: string[], menuItem: MenuOption) {
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
       * @param menuPath - Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       * @param menuItem - Menu item to insert.
       * @param position - Position to insert menu item. If negative, counts
       * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
       * the second-to-last one.
       * @returns The new length of the sub-menu
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuOption,
        position: number,
      ) {
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
}

export function createTestSession(snapshot = {}) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = RootModel(pluginManager)
  const root = JBrowseRootModel.create({
    jbrowse: {
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
    assemblyManager: {},
  })
  root.setSession({
    name: 'testSession',
    ...snapshot,
  })
  root.setHistory(UndoManager.create({}, { targetStore: root.session }))
  pluginManager.setRootModel(root)

  pluginManager.configure()
  return root.session as AbstractSessionModel
}
