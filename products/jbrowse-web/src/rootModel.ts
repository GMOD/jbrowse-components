import assemblyManagerFactory, {
  assemblyConfigSchemas as AssemblyConfigSchemasFactory,
} from '@gmod/jbrowse-core/assemblyManager'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { MenuItem } from '@gmod/jbrowse-core/ui'
import { AbstractSessionModel } from '@gmod/jbrowse-core/util'
import AddIcon from '@material-ui/icons/Add'
import { cast, getSnapshot, SnapshotIn, types } from 'mobx-state-tree'
import { UndoManager } from 'mst-middlewares'
import * as uuid from 'uuid'
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
    .views(() => ({
      get savedSessions() {
        return Object.entries(localStorage)
          .filter(obj => obj[0].startsWith('localSaved-'))
          .map(entry => JSON.parse(entry[1]).session)
      },
      get savedSessionNames() {
        return this.savedSessions.map(savedSession => savedSession.name)
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
      get isUnsavedSession() {
        const locationUrl = new URL(window.location.href)
        const params = new URLSearchParams(locationUrl.search)
        return params?.get('session')?.startsWith('local-')
      },
    }))
    .actions(self => ({
      setSession(sessionSnapshot?: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
      },
      setDefaultSession() {
        const newSession = {
          ...self.jbrowse.defaultSession,
          name: `${self.jbrowse.defaultSession.name} ${new Date(
            Date.now() - new Date().getTimezoneOffset() * 60000,
          )
            .toISOString()
            .substring(0, 10)} ${new Date(Date.now()).toLocaleTimeString()}`,
        }

        const localId = `local-${uuid.v4()}`
        sessionStorage.clear()
        sessionStorage.setItem(localId, JSON.stringify({ session: newSession }))
        this.setSessionUuidInUrl(localId)
        this.setSession(newSession)
        return localId
      },
      renameCurrentSession(sessionName: string) {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          const oldname = snapshot.name

          const snapInSession = Object.entries(sessionStorage)
            .filter(obj => obj[0].startsWith('local-'))
            .find(
              sessionSnap =>
                JSON.parse(sessionSnap[1]).session.name === oldname,
            )

          const snapInLocal = Object.entries(localStorage)
            .filter(obj => obj[0].startsWith('localSaved-'))
            .find(
              sessionSnap =>
                JSON.parse(sessionSnap[1]).session.name === oldname,
            )
          snapshot.name = sessionName
          if (snapInSession)
            sessionStorage.setItem(
              snapInSession[0],
              JSON.stringify({ session: snapshot }),
            )
          else if (snapInLocal)
            localStorage.setItem(
              snapInLocal[0],
              JSON.stringify({ session: snapshot }),
            )
          this.setSession(snapshot)
        }
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
          const localId = `local-${uuid.v4()}`
          sessionStorage.clear()
          sessionStorage.setItem(localId, JSON.stringify({ session: snapshot }))
          this.setSessionUuidInUrl(localId)
          this.setSession(snapshot)
        }
      },
      activateSession(name: string) {
        const newSessionSnapshot = Object.entries(localStorage)
          .filter(obj => obj[0].startsWith('localSaved-'))
          .find(sessionSnap => JSON.parse(sessionSnap[1]).session.name === name)

        if (!newSessionSnapshot)
          throw new Error(
            `Can't activate session ${name}, it is not in the savedSessions`,
          )

        const [localId, sessionObj] = newSessionSnapshot
        this.setSessionUuidInUrl(localId)
        this.setSession(JSON.parse(sessionObj).session)
      },
      saveSessionToLocalStorage() {
        if (self.session && self.isUnsavedSession) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          const localId = `localSaved-${self.currentSessionId || uuid.v4()}`
          try {
            localStorage.setItem(localId, JSON.stringify({ session: snapshot }))
          } catch (e) {
            if (e.code === '22' || e.code === '1024') {
              // eslint-disable-next-line no-alert
              alert(
                'Local storage is full! Please open sessions and remove some before saving',
              )
            }
          }
        }
      },
      loadAutosaveSession() {
        const autosavedSession = JSON.parse(
          localStorage.getItem('localSaved-previousAutosave') || '',
        ).session
        autosavedSession.name = `${autosavedSession.name}-restored`
        const localId = `local-${uuid.v4()}`
        sessionStorage.clear()
        sessionStorage.setItem(
          localId,
          JSON.stringify({ session: autosavedSession }),
        )
        this.setSessionUuidInUrl(localId)
        this.setSession(autosavedSession)
        return localId
      },
      setSessionUuidInUrl(localId: string) {
        const locationUrl = new URL(window.location.href)
        const params = new URLSearchParams(locationUrl.search)
        params.set('session', `${localId}`)
        locationUrl.search = params.toString()
        window.history.replaceState({}, '', locationUrl.href)
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
                let result
                if (self.isUnsavedSession)
                  // eslint-disable-next-line no-alert
                  result = window.confirm(
                    'You have unsaved changes. Click OK if you would like to save before continuing',
                  )
                if (result) session.saveSessionToLocalStorage()
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
