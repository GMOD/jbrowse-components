import {
  addDisposer,
  cast,
  getSnapshot,
  getType,
  getPropertyMembers,
  getChildType,
  isArrayType,
  isModelType,
  isReferenceType,
  isValidReference,
  isMapType,
  resolveIdentifier,
  types,
  IAnyStateTreeNode,
  IAnyType,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'

import { saveAs } from 'file-saver'
import { observable, autorun } from 'mobx'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { UriLocation } from '@jbrowse/core/util/types'
import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'
import { MenuItem } from '@jbrowse/core/ui'

// icons
import AddIcon from '@material-ui/icons/Add'
import SettingsIcon from '@material-ui/icons/Settings'
import AppsIcon from '@material-ui/icons/Apps'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import FolderOpenIcon from '@material-ui/icons/FolderOpen'
import GetAppIcon from '@material-ui/icons/GetApp'
import PublishIcon from '@material-ui/icons/Publish'
import ExtensionIcon from '@material-ui/icons/Extension'
import StorageIcon from '@material-ui/icons/Storage'
import SaveIcon from '@material-ui/icons/Save'
import { Cable } from '@jbrowse/core/ui/Icons'

// other
import corePlugins from './corePlugins'
import jbrowseWebFactory from './jbrowseModel'
// @ts-ignore
import RenderWorker from './rpc.worker'
import sessionModelFactory from './sessionModelFactory'

// attempts to remove undefined references from the given MST model. can only actually
// remove them from arrays and maps. throws MST undefined ref error if it encounters
// undefined refs in model properties
function filterSessionInPlace(node: IAnyStateTreeNode, nodeType: IAnyType) {
  type MSTArray = Instance<ReturnType<typeof types.array>>
  type MSTMap = Instance<ReturnType<typeof types.map>>

  // makes it work with session sharing
  if (node === undefined) {
    return
  }
  if (isArrayType(nodeType)) {
    const array = node as MSTArray
    const childType = getChildType(node)
    if (isReferenceType(childType)) {
      // filter array elements
      for (let i = 0; i < array.length; ) {
        if (!isValidReference(() => array[i])) {
          array.splice(i, 1)
        } else {
          i += 1
        }
      }
    }
    array.forEach(el => {
      filterSessionInPlace(el, childType)
    })
  } else if (isMapType(nodeType)) {
    const map = node as MSTMap
    const childType = getChildType(map)
    if (isReferenceType(childType)) {
      // filter the map members
      for (const key in map.keys()) {
        if (!isValidReference(() => map.get(key))) {
          map.delete(key)
        }
      }
    }
    map.forEach(child => {
      filterSessionInPlace(child, childType)
    })
  } else if (isModelType(nodeType)) {
    // iterate over children
    const { properties } = getPropertyMembers(node)

    Object.entries(properties).forEach(([pname, ptype]) => {
      // @ts-ignore
      filterSessionInPlace(node[pname], ptype)
    })
  }
}

interface Menu {
  label: string
  menuItems: MenuItem[]
}

export default function RootModel(
  pluginManager: PluginManager,
  adminMode = false,
) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const Session = sessionModelFactory(pluginManager, assemblyConfigSchema)
  const assemblyManagerType = assemblyManagerFactory(
    assemblyConfigSchema,
    pluginManager,
  )
  return types
    .model('Root', {
      jbrowse: jbrowseWebFactory(pluginManager, Session, assemblyConfigSchema),
      configPath: types.maybe(types.string),
      session: types.maybe(Session),
      assemblyManager: assemblyManagerType,
      version: types.maybe(types.string),
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
      isAssemblyEditing: false,
      isDefaultSessionEditing: false,
    })
    .volatile(self => ({
      pluginsUpdated: false,
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { WorkerClass: RenderWorker },
          MainThreadRpcDriver: {},
        },
      ),
      savedSessionsVolatile: observable.map({}),
      textSearchManager: new TextSearchManager(pluginManager),
      pluginManager,
      error: undefined as unknown,
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
            for (const [, val] of self.savedSessionsVolatile.entries()) {
              try {
                const key = self.localStorageId(val.name)
                localStorage.setItem(key, JSON.stringify({ session: val }))
              } catch (e) {
                // @ts-ignore
                if (e.code === '22' || e.code === '1024') {
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
                if (self.pluginsUpdated) {
                  // reload app to get a fresh plugin manager
                  window.location.reload()
                }
              }
            },
            { delay: 400 },
          ),
        )
        addDisposer(
          self,
          autorun(() => {
            self.jbrowse.internetAccounts.forEach(account => {
              this.initializeInternetAccount(account.internetAccountId)
            })
          }),
        )
      },
      setSession(sessionSnapshot?: SnapshotIn<typeof Session>) {
        const oldSession = self.session
        self.session = cast(sessionSnapshot)
        if (self.session) {
          // validate all references in the session snapshot
          try {
            filterSessionInPlace(self.session, getType(self.session))
          } catch (error) {
            // throws error if session filtering failed
            self.session = oldSession
            throw error
          }
        }
      },
      initializeInternetAccount(
        internetAccountId: string,
        initialSnapshot = {},
      ) {
        const internetAccountConfigSchema =
          pluginManager.pluggableConfigSchemaType('internet account')
        const configuration = resolveIdentifier(
          internetAccountConfigSchema,
          self,
          internetAccountId,
        )

        const internetAccountType = pluginManager.getInternetAccountType(
          configuration.type,
        )
        if (!internetAccountType) {
          throw new Error(`unknown internet account type ${configuration.type}`)
        }

        const internetAccount = internetAccountType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot = {},
        location: UriLocation,
      ) {
        let hostUri

        try {
          hostUri = new URL(location.uri).origin
        } catch (e) {
          // ignore
        }
        // id of a custom new internaccount is `${type}-${name}`
        const internetAccountSplit = internetAccountId.split('-')
        const configuration = {
          type: internetAccountSplit[0],
          internetAccountId: internetAccountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        const internetAccountType = pluginManager.getInternetAccountType(
          configuration.type,
        )
        const internetAccount = internetAccountType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      setAssemblyEditing(flag: boolean) {
        self.isAssemblyEditing = flag
      },
      setDefaultSessionEditing(flag: boolean) {
        self.isDefaultSessionEditing = flag
      },
      setPluginsUpdated(flag: boolean) {
        self.pluginsUpdated = flag
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

      setError(error?: unknown) {
        self.error = error
      },
      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        // if no existing account or not found, try to find working account
        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        // if still no existing account, create ephemeral config to use
        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location)
          : null
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
              label: 'Import session…',
              icon: PublishIcon,
              onClick: (session: SessionWithWidgets) => {
                const widget = session.addWidget(
                  'ImportSessionWidget',
                  'importSessionWidget',
                )
                session.showWidget(widget)
              },
            },
            {
              label: 'Export session',
              icon: GetAppIcon,
              onClick: (session: IAnyStateTreeNode) => {
                const sessionBlob = new Blob(
                  [JSON.stringify({ session: getSnapshot(session) }, null, 2)],
                  { type: 'text/plain;charset=utf-8' },
                )
                saveAs(sessionBlob, 'session.json')
              },
            },
            {
              label: 'Open session…',
              icon: FolderOpenIcon,
              onClick: (session: SessionWithWidgets) => {
                const widget = session.addWidget(
                  'SessionManager',
                  'sessionManager',
                )
                session.showWidget(widget)
              },
            },
            {
              label: 'Save session',
              icon: SaveIcon,
              onClick: (session: SessionWithWidgets) => {
                self.saveSessionToLocalStorage()
                session.notify(`Saved session "${session.name}"`, 'success')
              },
            },
            {
              label: 'Duplicate session',
              icon: FileCopyIcon,
              onClick: (session: AbstractSessionModel) => {
                if (session.duplicateCurrentSession) {
                  session.duplicateCurrentSession()
                }
              },
            },
            { type: 'divider' },
            {
              label: 'Open track...',
              icon: StorageIcon,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick: (session: any) => {
                if (session.views.length === 0) {
                  session.notify('Please open a view to add a track first')
                } else if (session.views.length >= 1) {
                  const widget = session.addWidget(
                    'AddTrackWidget',
                    'addTrackWidget',
                    { view: session.views[0].id },
                  )
                  session.showWidget(widget)
                  if (session.views.length > 1) {
                    session.notify(
                      `This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right`,
                    )
                  }
                }
              },
            },
            {
              label: 'Open connection...',
              icon: Cable,
              onClick: () => {
                if (self.session) {
                  const widget = self.session.addWidget(
                    'AddConnectionWidget',
                    'addConnectionWidget',
                  )
                  self.session.showWidget(widget)
                }
              },
            },
            { type: 'divider' },
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
                    onClick: () => {
                      self.setAssemblyEditing(true)
                    },
                  },
                  {
                    label: 'Set default session',
                    icon: SettingsIcon,
                    onClick: () => {
                      self.setDefaultSessionEditing(true)
                    },
                  },
                ],
              },
            ]
          : []),
        {
          label: 'Add',
          menuItems: [],
        },
        {
          label: 'Tools',
          menuItems: [
            {
              label: 'Plugin store',
              icon: ExtensionIcon,
              onClick: () => {
                if (self.session) {
                  const widget = self.session.addWidget(
                    'PluginStoreWidget',
                    'pluginStoreWidget',
                  )
                  self.session.showWidget(widget)
                }
              },
            },
          ],
        },
      ] as Menu[],
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

export function createTestSession(snapshot = {}, adminMode = false) {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()

  const JBrowseRootModel = RootModel(pluginManager, adminMode)
  const root = JBrowseRootModel.create(
    {
      jbrowse: {
        configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
      },
      assemblyManager: {},
    },
    { pluginManager },
  )
  root.setSession({
    name: 'testSession',
    ...snapshot,
  })
  // @ts-ignore
  root.session.views.map(view => view.setWidth(800))
  pluginManager.setRootModel(root)

  pluginManager.configure()
  return root.session as AbstractSessionModel
}
