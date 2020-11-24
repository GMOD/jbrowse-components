/* eslint curly:error*/
import assemblyManagerFactory, {
  assemblyConfigSchemas as AssemblyConfigSchemasFactory,
} from '@jbrowse/core/assemblyManager'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel } from '@jbrowse/core/util'
import AddIcon from '@material-ui/icons/Add'
import SettingsIcon from '@material-ui/icons/Settings'
import AppsIcon from '@material-ui/icons/Apps'
import {
  addDisposer,
  cast,
  getSnapshot,
  getParent,
  SnapshotIn,
  types,
} from 'mobx-state-tree'
import { observable, autorun } from 'mobx'
import { UndoManager } from 'mst-middlewares'
import corePlugins from './corePlugins'
import jbrowseWebFactory from './jbrowseModel'
// @ts-ignore
import RenderWorker from './rpc.worker'
import sessionModelFactory from './sessionModelFactory'

interface Menu {
  label: string
  menuItems: MenuItem[]
}

export default function RootModel(
  pluginManager: PluginManager,
  adminMode = false,
) {
  const Session = sessionModelFactory(pluginManager)
  const { assemblyConfigSchemas, dispatcher } = AssemblyConfigSchemasFactory(
    pluginManager,
  )
  const assemblyConfigSchemasType = types.union(
    { dispatcher },
    ...assemblyConfigSchemas,
  )
  const assemblyManagerType = assemblyManagerFactory(
    assemblyConfigSchemasType,
    pluginManager,
  )
  return types
    .model('Root', {
      jbrowse: jbrowseWebFactory(
        pluginManager,
        Session,
        assemblyConfigSchemasType,
      ),
      configPath: types.maybe(types.string),
      session: types.maybe(Session),
      assemblyManager: assemblyManagerType,
      version: types.maybe(types.string),
      isAssemblyEditing: false,
      isDefaultSessionEditing: false,
    })
    .volatile(() => ({
      savedSessionsVolatile: observable.map({}),
      pluginManager,
      error: undefined as undefined | Error,
    }))
    .views(self => ({
      get savedSessions() {
        return Array.from(self.savedSessionsVolatile.values())
      },
      localStorageId(name: string) {
        return `localSaved-${name}-${self.configPath}`
      },
      get autosaveId() {
        return `autosave-${self.configPath}`
      },
      get previousAutosaveId() {
        return `previousAutosave-${self.configPath}`
      },
    }))
    .views(self => ({
      get savedSessionNames() {
        return self.savedSessions.map(session => session.name)
      },
      get currentSessionId() {
        const locationUrl = new URL(window.location.href)
        const params = new URLSearchParams(locationUrl.search)
        return params?.get('session')?.split('local-')[1]
      },
    }))
    .actions(self => ({
      afterCreate() {
        Object.entries(localStorage)
          .filter(([key, _val]) => key.startsWith('localSaved-'))
          .filter(
            ([key, _val]) => key.indexOf(self.configPath || 'undefined') !== -1,
          )
          .forEach(([key, val]) => {
            try {
              const { session } = JSON.parse(val)
              self.savedSessionsVolatile.set(key, session)
            } catch (e) {
              console.error('bad session encountered', key, val)
            }
          })
        addDisposer(
          self,
          autorun(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [_, val] of self.savedSessionsVolatile.entries()) {
              try {
                const key = self.localStorageId(val.name)
                localStorage.setItem(key, JSON.stringify({ session: val }))
              } catch (e) {
                if (e.code === '22' || e.code === '1024') {
                  // eslint-disable-next-line no-alert
                  alert(
                    'Local storage is full! Please use the "Open sessions" panel to remove old sessions',
                  )
                }
              }
            }
          }),
        )
        addDisposer(
          self,
          autorun(
            () => {
              if (self.session) {
                const noSession = { name: 'empty' }
                const snapshot = getSnapshot(self.session) || noSession
                sessionStorage.setItem(
                  'current',
                  JSON.stringify({ session: snapshot }),
                )

                localStorage.setItem(
                  `autosave-${self.configPath}`,
                  JSON.stringify({
                    session: {
                      ...snapshot,
                      name: `${snapshot.name}-autosaved`,
                    },
                  }),
                )
              }
            },
            { delay: 400 },
          ),
        )
      },
      setSession(sessionSnapshot?: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
      },
      setAssemblyEditing(flag: boolean) {
        self.isAssemblyEditing = flag
      },
      setDefaultSessionEditing(flag: boolean) {
        self.isDefaultSessionEditing = flag
      },
      setDefaultSession() {
        const { defaultSession } = self.jbrowse
        const newSession = {
          ...defaultSession,
          name: `${defaultSession.name} ${new Date().toLocaleString()}`,
        }

        this.setSession(newSession)
      },
      renameCurrentSession(sessionName: string) {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          snapshot.name = sessionName
          this.setSession(snapshot)
        }
      },

      addSavedSession(session: { name: string }) {
        const key = self.localStorageId(session.name)
        self.savedSessionsVolatile.set(key, session)
      },

      removeSavedSession(session: { name: string }) {
        const key = self.localStorageId(session.name)
        localStorage.removeItem(key)
        self.savedSessionsVolatile.delete(key)
      },

      duplicateCurrentSession() {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          let newSnapshotName = `${self.session.name} (copy)`
          if (self.savedSessionNames.includes(newSnapshotName)) {
            let newSnapshotCopyNumber = 2
            do {
              newSnapshotName = `${self.session.name} (copy ${newSnapshotCopyNumber})`
              newSnapshotCopyNumber += 1
            } while (self.savedSessionNames.includes(newSnapshotName))
          }
          snapshot.name = newSnapshotName
          this.setSession(snapshot)
        }
      },
      activateSession(name: string) {
        const localId = self.localStorageId(name)
        const newSessionSnapshot = localStorage.getItem(localId)
        if (!newSessionSnapshot) {
          throw new Error(
            `Can't activate session ${name}, it is not in the savedSessions`,
          )
        }

        this.setSession(JSON.parse(newSessionSnapshot).session)
      },
      saveSessionToLocalStorage() {
        if (self.session) {
          const key = self.localStorageId(self.session.name)
          self.savedSessionsVolatile.set(key, getSnapshot(self.session))
        }
      },
      loadAutosaveSession() {
        const previousAutosave = localStorage.getItem(self.previousAutosaveId)
        const autosavedSession = previousAutosave
          ? JSON.parse(previousAutosave).session
          : {}
        const { name } = autosavedSession
        autosavedSession.name = `${name.replace('-autosaved', '')}-restored`
        this.setSession(autosavedSession)
      },

      setError(error: Error) {
        self.error = error
      },
    }))
    .volatile(self => ({
      history: {},
      menus: [
        {
          label: 'File',
          menuItems: [
            {
              label: 'New session',
              icon: AddIcon,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick: (session: any) => {
                const lastAutosave = localStorage.getItem(self.autosaveId)
                if (lastAutosave) {
                  localStorage.setItem(self.previousAutosaveId, lastAutosave)
                }
                session.setDefaultSession()
              },
            },
            {
              label: 'Return to splash screen',
              icon: AppsIcon,
              onClick: () => {
                self.setSession(undefined)
              },
            },
          ],
        },
        ...(adminMode
          ? [
              {
                label: 'Admin',
                menuItems: [
                  {
                    label: 'Open assembly manager',
                    icon: SettingsIcon,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick: (session: any) => {
                      const rootModel = getParent(session)
                      rootModel.setAssemblyEditing(true)
                    },
                  },
                  {
                    label: 'Set default session',
                    icon: SettingsIcon,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick: (session: any) => {
                      const rootModel = getParent(session)
                      rootModel.setDefaultSessionEditing(true)
                    },
                  },
                ],
              },
            ]
          : []),
      ] as Menu[],
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.plugins,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { WorkerClass: RenderWorker },
          MainThreadRpcDriver: {},
        },
      ),
      adminMode,
    }))
    .actions(self => ({
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
      appendToMenu(menuName: string, menuItem: MenuItem) {
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
      insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
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
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
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
        menuItem: MenuItem,
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
  // @ts-ignore
  root.session.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(root)

  pluginManager.configure()
  return root.session as AbstractSessionModel
}
