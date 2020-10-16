import assemblyManagerFactory, {
  assemblyConfigSchemas as AssemblyConfigSchemasFactory,
} from '@jbrowse/core/assemblyManager'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel } from '@jbrowse/core/util'
import AddIcon from '@material-ui/icons/Add'
import {
  addDisposer,
  cast,
  getSnapshot,
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
      version: types.maybe(types.string),
    })
    .volatile(() => ({
      savedSessionsVolatile: observable.map({}),
    }))
    .views(self => ({
      get savedSessions() {
        return Array.from(self.savedSessionsVolatile.values())
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
      get hasRecoverableAutosave() {
        return !!Object.keys(localStorage).find(
          key => key === 'localSaved-previousAutosave',
        )
      },
    }))
    .actions(self => ({
      afterCreate() {
        Object.entries(localStorage)
          .filter(
            ([key, _val]) =>
              key.startsWith('localSaved-') &&
              !key.endsWith('previousAutosave'),
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
                localStorage.setItem(
                  `localSaved-${val.name}`,
                  JSON.stringify({ session: val }),
                )
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
      },
      setSession(sessionSnapshot?: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
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

      addSavedSession(sessionSnapshot: { name: string }) {
        self.savedSessionsVolatile.set(
          `localSaved-${sessionSnapshot.name}`,
          sessionSnapshot,
        )
      },

      removeSavedSession(session: { name: string }) {
        const key = `localSaved-${session.name}`
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
        const localId = `localSaved-${name}`
        const newSessionSnapshot = localStorage.getItem(localId)
        console.log({name,newSessionSnapshot});
        if (!newSessionSnapshot)
          throw new Error(
            `Can't activate session ${name}, it is not in the savedSessions`,
          )

        this.setSession(JSON.parse(newSessionSnapshot).session)
      },
      saveSessionToLocalStorage() {
        if (self.session) {
          self.savedSessionsVolatile.set(
            `localSaved-${self.session.name}`,
            getSnapshot(self.session),
          )
          // const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          // // @ts-ignore
          // const localId = `localSaved-${self.session.name}`
          //
        }
      },
      loadAutosaveSession() {
        const autosavedSession = JSON.parse(
          localStorage.getItem('localSaved-previousAutosave') || '',
        ).session
        autosavedSession.name = `${autosavedSession.name.replace(
          '-autosaved',
          '',
        )}-restored`
        // const localId = `local-${uuid.v4()}`
        // sessionStorage.clear()
        // sessionStorage.setItem(
        //   localId,
        //   JSON.stringify({ session: autosavedSession }),
        // )
        this.setSession(autosavedSession)
        // return localId
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
              label: 'New session',
              icon: AddIcon,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick: (session: any) => {
                const lastAutosave = localStorage.getItem('autosave')
                if (lastAutosave) {
                  localStorage.setItem(
                    'localSaved-previousAutosave',
                    lastAutosave,
                  )
                }
                session.setDefaultSession()
              },
            },
          ],
        },
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
