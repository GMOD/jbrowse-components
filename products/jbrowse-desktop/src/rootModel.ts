import {
  addDisposer,
  cast,
  resolveIdentifier,
  getSnapshot,
  types,
  SnapshotIn,
  Instance,
  IAnyModelType,
} from 'mobx-state-tree'
import { autorun } from 'mobx'
import makeWorkerInstance from './makeWorkerInstance'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import { MenuItem } from '@jbrowse/core/ui'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { UriLocation } from '@jbrowse/core/util/types'

// icons
import OpenIcon from '@mui/icons-material/FolderOpen'
import ExtensionIcon from '@mui/icons-material/Extension'
import AppsIcon from '@mui/icons-material/Apps'
import StorageIcon from '@mui/icons-material/Storage'
import SettingsIcon from '@mui/icons-material/Settings'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import { Save, SaveAs, DNA, Cable } from '@jbrowse/core/ui/Icons'

// locals
import sessionModelFactory from './sessionModelFactory'
import jobsModelFactory from './indexJobsModel'
import JBrowseDesktop from './jbrowseModel'
import OpenSequenceDialog from './OpenSequenceDialog'

const { ipcRenderer } = window.require('electron')

function getSaveSession(model: RootModel) {
  return {
    ...getSnapshot(model.jbrowse),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
}

interface Menu {
  label: string
  menuItems: MenuItem[]
}

export default function rootModelFactory(pluginManager: PluginManager) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const Session = sessionModelFactory(pluginManager, assemblyConfigSchema)
  const JobsManager = jobsModelFactory(pluginManager)
  return types
    .model('Root', {
      jbrowse: JBrowseDesktop(pluginManager, Session, assemblyConfigSchema),
      session: types.maybe(Session),
      jobsManager: types.maybe(JobsManager),
      assemblyManager: assemblyManagerFactory(
        assemblyConfigSchema,
        pluginManager,
      ),
      savedSessionNames: types.maybe(types.array(types.string)),
      version: types.maybe(types.string),
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
      sessionPath: types.optional(types.string, ''),
      history: types.optional(TimeTraveller, { targetPath: '../session' }),
    })
    .volatile(() => ({
      isAssemblyEditing: false,
      error: undefined as unknown,
      textSearchManager: new TextSearchManager(pluginManager),
      openNewSessionCallback: async (_path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
      pluginManager,
    }))
    .actions(self => ({
      async saveSession(val: unknown) {
        if (self.sessionPath) {
          await ipcRenderer.invoke('saveSession', self.sessionPath, val)
        }
      },
      setOpenNewSessionCallback(cb: (arg: string) => Promise<void>) {
        self.openNewSessionCallback = cb
      },
      setSavedSessionNames(sessionNames: string[]) {
        self.savedSessionNames = cast(sessionNames)
      },
      setSessionPath(path: string) {
        self.sessionPath = path
      },
      setSession(sessionSnapshot?: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
      },
      setError(error: unknown) {
        self.error = error
      },
      setDefaultSession() {
        this.setSession(self.jbrowse.defaultSession)
      },
      setAssemblyEditing(flag: boolean) {
        self.isAssemblyEditing = flag
      },

      async renameCurrentSession(newName: string) {
        if (self.session) {
          this.setSession({ ...getSnapshot(self.session), name: newName })
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
      initializeInternetAccount(id: string, initialSnapshot = {}) {
        const schema = pluginManager.pluggableConfigSchemaType(
          'internet account',
        ) as IAnyModelType
        const configuration = resolveIdentifier(schema, self, id)

        const accountType = pluginManager.getInternetAccountType(
          configuration.type,
        )
        if (!accountType) {
          throw new Error(`unknown internet account type ${configuration.type}`)
        }

        const internetAccount = accountType.stateModel.create({
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
        url: string,
      ) {
        let hostUri

        try {
          hostUri = new URL(url).origin
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
          domains: [hostUri],
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
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
    }))
    .volatile(self => ({
      menus: [
        {
          label: 'File',
          menuItems: [
            {
              label: 'Open',
              icon: OpenIcon,
              onClick: async () => {
                try {
                  const path = await ipcRenderer.invoke('promptOpenFile')
                  if (path) {
                    await self.openNewSessionCallback(path)
                  }
                } catch (e) {
                  console.error(e)
                  self.session?.notify(`${e}`, 'error')
                }
              },
            },
            {
              label: 'Save',
              icon: Save,
              onClick: async () => {
                if (self.session) {
                  try {
                    await self.saveSession(getSaveSession(self as RootModel))
                  } catch (e) {
                    console.error(e)
                    self.session?.notify(`${e}`, 'error')
                  }
                }
              },
            },
            {
              label: 'Save as...',
              icon: SaveAs,
              onClick: async () => {
                try {
                  const saveAsPath = await ipcRenderer.invoke(
                    'promptSessionSaveAs',
                  )
                  self.setSessionPath(saveAsPath)
                  await self.saveSession(getSaveSession(self as RootModel))
                } catch (e) {
                  console.error(e)
                  self.session?.notify(`${e}`, 'error')
                }
              },
            },
            {
              type: 'divider',
            },
            {
              label: 'Open assembly...',
              icon: DNA,
              onClick: () => {
                if (self.session) {
                  self.session.queueDialog(doneCallback => [
                    OpenSequenceDialog,
                    {
                      model: self,
                      onClose: (confs: AnyConfigurationModel[]) => {
                        try {
                          confs?.forEach(conf => {
                            self.jbrowse.addAssemblyConf(conf)
                          })
                        } catch (e) {
                          console.error(e)
                          self.session?.notify(`${e}`)
                        }
                        doneCallback()
                      },
                    },
                  ])
                }
              },
            },
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
            {
              type: 'divider',
            },
            {
              label: 'Return to start screen',
              icon: AppsIcon,
              onClick: () => {
                self.setSession(undefined)
              },
            },
            {
              label: 'Exit',
              icon: MeetingRoomIcon,
              onClick: () => {
                ipcRenderer.invoke('quit')
              },
            },
          ],
        },
        {
          label: 'Add',
          menuItems: [],
        },
        {
          label: 'Tools',
          menuItems: [
            {
              label: 'Undo',
              disabled: self.history.canUndo,
              icon: UndoIcon,
              onClick: () => {
                self.history.undo()
              },
            },
            {
              label: 'Redo',
              disabled: self.history.canRedo,
              icon: RedoIcon,
              onClick: () => {
                self.history.redo()
              },
            },
            { type: 'divider' },
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
            {
              label: 'Open assembly manager',
              icon: SettingsIcon,
              onClick: () => {
                self.setAssemblyEditing(true)
              },
            },
          ],
        },
      ] as Menu[],
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: {
            makeWorkerInstance,
          },
          MainThreadRpcDriver: {},
        },
      ),
      adminMode: true,
    }))
    .actions(self => ({
      activateSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.setSession(sessionSnapshot)
      },
      setMenus(newMenus: Menu[]) {
        self.menus = newMenus
      },
      async setPluginsUpdated() {
        if (self.session) {
          await self.saveSession(getSaveSession(self as RootModel))
        }
        await self.openNewSessionCallback(self.sessionPath)
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

      afterCreate() {
        document.addEventListener('keydown', event => {
          if (self.history.canRedo) {
            if (
              // ctrl+shift+z or cmd+shift+z
              ((event.ctrlKey || event.metaKey) &&
                event.shiftKey &&
                event.code === 'KeyZ') ||
              // ctrl+y
              (event.ctrlKey && !event.shiftKey && event.code === 'KeyY')
            ) {
              self.history.redo()
            }
          } else if (self.history.canUndo) {
            if (
              // ctrl+z or cmd+z
              (event.ctrlKey || event.metaKey) &&
              !event.shiftKey &&
              event.code === 'KeyZ'
            ) {
              self.history.undo()
            }
          }
        })
        addDisposer(
          self,
          autorun(() => {
            if (self.session) {
              // we use a specific initialization routine after session is
              // created to get it to start tracking itself sort of related
              // issue here
              // https://github.com/mobxjs/mobx-state-tree/issues/1089#issuecomment-441207911
              self.history.initialize()
            }
          }),
        )
        addDisposer(
          self,
          autorun(() => {
            self.jbrowse.internetAccounts.forEach(account => {
              self.initializeInternetAccount(account.internetAccountId)
            })
          }),
        )
        addDisposer(
          self,
          autorun(
            async () => {
              if (self.session) {
                try {
                  await self.saveSession(getSaveSession(self as RootModel))
                } catch (e) {
                  console.error(e)
                }
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type RootModelType = ReturnType<typeof rootModelFactory>
export type RootModel = Instance<RootModelType>
