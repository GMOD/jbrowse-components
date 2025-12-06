import { lazy } from 'react'

import {
  filterSessionInPlace,
  getOpenConnectionMenuItem,
  getOpenTrackMenuItem,
  getPluginStoreMenuItem,
  getRedoMenuItem,
  getUndoMenuItem,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { DNA } from '@jbrowse/core/ui/Icons'
import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import {
  addDisposer,
  cast,
  getSnapshot,
  getType,
  types,
} from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import AppsIcon from '@mui/icons-material/Apps'
import OpenIcon from '@mui/icons-material/FolderOpen'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import SaveAsIcon from '@mui/icons-material/SaveAs'
import SettingsIcon from '@mui/icons-material/Settings'
import { autorun } from 'mobx'

import packageJSON from '../../package.json'
import OpenSequenceDialog from '../components/OpenSequenceDialog'
import jobsModelFactory from '../indexJobsModel'
import JBrowseDesktop from '../jbrowseModel'
import makeWorkerInstance from '../makeWorkerInstance'
import sessionModelFactory from '../sessionModel/sessionModel'

import type {
  DesktopSessionModel,
  DesktopSessionModelType,
} from '../sessionModel/sessionModel'
import type { Menu, MenuAction } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { SessionWithDialogs } from '@jbrowse/product-core'

// lazies
const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))

const { ipcRenderer } = window.require('electron')

export function getSaveSession(model: { jbrowse: unknown; session: unknown }) {
  const snap = getSnapshot(model.jbrowse as object)
  return {
    ...(snap as Record<string, unknown>),
    defaultSession: model.session ? getSnapshot(model.session as object) : {},
  }
}

/**
 * #stateModel JBrowseDesktopRootModel
 * #category root
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function rootModelFactory(pluginManager: PluginManager) {
  const assemblyConfigSchema = assemblyConfigSchemaF(pluginManager)
  const sessionModelType: DesktopSessionModelType = sessionModelFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  const jbrowseModelType = JBrowseDesktop(pluginManager, assemblyConfigSchema)
  const JobsManager = jobsModelFactory(pluginManager)
  return types
    .model('JBrowseDesktopRootModel', {
      /**
       * #property
       */
      jbrowse: jbrowseModelType,
      /**
       * #property
       */
      session: types.maybe(sessionModelType),
      /**
       * #property
       */
      sessionPath: types.optional(types.string, ''),
      /**
       * #property
       */
      assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      ),
      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
      /**
       * #property
       */
      history: types.optional(TimeTraveller, { targetPath: '../session' }),
      /**
       * #property
       */
      jobsManager: types.optional(JobsManager, {}),
    })
    .volatile(self => ({
      /**
       * #volatile
       */
      pluginManager,
      /**
       * #volatile
       */
      version: packageJSON.version,
      /**
       * #volatile
       */
      adminMode: true,
      /**
       * #volatile
       */
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { makeWorkerInstance },
          MainThreadRpcDriver: {},
        },
      ),
      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
      /**
       * #volatile
       */
      error: undefined as unknown,
      /**
       * #volatile
       */
      openNewSessionCallback: async (_path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
      /**
       * #volatile
       */
      mutableMenuActions: [] as MenuAction[],
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSession(sessionSnapshot?: SnapshotIn<DesktopSessionModelType>) {
        const oldSession = self.session
        self.session = cast(sessionSnapshot)
        if (self.session) {
          try {
            filterSessionInPlace(self.session, getType(self.session))
          } catch (error) {
            self.session = oldSession
            throw error
          }
        }
      },
      /**
       * #action
       */
      setSessionPath(path: string) {
        self.sessionPath = path
      },
      /**
       * #action
       */
      setError(error: unknown) {
        self.error = error
      },
      /**
       * #action
       */
      setOpenNewSessionCallback(cb: (arg: string) => Promise<void>) {
        self.openNewSessionCallback = cb
      },
      /**
       * #action
       */
      async saveSession(val: unknown) {
        if (self.sessionPath) {
          await ipcRenderer.invoke('saveSession', self.sessionPath, val)
        }
      },
      /**
       * #action
       */
      initializeInternetAccount(
        internetAccountConfig: AnyConfigurationModel,
        initialSnapshot = {},
      ) {
        const internetAccountType = pluginManager.getInternetAccountType(
          internetAccountConfig.type,
        )
        if (!internetAccountType) {
          throw new Error(
            `unknown internet account type ${internetAccountConfig.type}`,
          )
        }

        const length = self.internetAccounts.push({
          ...initialSnapshot,
          type: internetAccountConfig.type,
          configuration: internetAccountConfig,
        })
        return self.internetAccounts[length - 1]
      },
      /**
       * #action
       */
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot: Record<string, unknown>,
        url: string,
      ) {
        let hostUri: string | undefined

        try {
          hostUri = new URL(url).origin
        } catch {
          // ignore
        }
        const internetAccountSplit = internetAccountId.split('-')
        const configuration = {
          type: internetAccountSplit[0]!,
          internetAccountId: internetAccountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        const type = pluginManager.getInternetAccountType(configuration.type)!
        const internetAccount = type.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
      /**
       * #action
       */
      setMenus(newMenus: Menu[]) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'setMenus', newMenus },
        ]
      },
      /**
       * #action
       */
      appendMenu(menuName: string) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendMenu', menuName },
        ]
      },
      /**
       * #action
       */
      insertMenu(menuName: string, position: number) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'insertMenu', menuName, position },
        ]
      },
      /**
       * #action
       */
      appendToMenu(menuName: string, menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendToMenu', menuName, menuItem },
        ]
      },
      /**
       * #action
       */
      insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
        self.mutableMenuActions.push({
          type: 'insertInMenu',
          menuName,
          menuItem,
          position,
        })
      },
      /**
       * #action
       */
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendToSubMenu', menuPath, menuItem },
        ]
      },
      /**
       * #action
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'insertInSubMenu', menuPath, menuItem, position },
        ]
      },
    }))
    .actions(self => {
      const keydownListener = (e: KeyboardEvent) => {
        if (
          self.history.canRedo &&
          (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
            (e.ctrlKey && !e.shiftKey && e.code === 'KeyY')) &&
          document.activeElement?.tagName.toUpperCase() !== 'INPUT'
        ) {
          self.history.redo()
        }
        if (
          self.history.canUndo &&
          (e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.code === 'KeyZ' &&
          document.activeElement?.tagName.toUpperCase() !== 'INPUT'
        ) {
          self.history.undo()
        }
      }

      return {
        afterCreate() {
          document.addEventListener('keydown', keydownListener)
          addDisposer(
            self,
            autorun(
              function historyInitAutorun() {
                if (self.session) {
                  self.history.initialize()
                }
              },
              { name: 'HistoryInit' },
            ),
          )

          addDisposer(
            self,
            autorun(
              function internetAccountsAutorun() {
                for (const internetAccount of self.jbrowse.internetAccounts) {
                  self.initializeInternetAccount(internetAccount)
                }
              },
              { name: 'InternetAccounts' },
            ),
          )

          addDisposer(
            self,
            autorun(
              async () => {
                if (!self.session) {
                  return
                }
                try {
                  await self.saveSession(getSaveSession(self))
                } catch (e) {
                  console.error(e)
                }
              },
              { delay: 1000 },
            ),
          )
        },
        beforeDestroy() {
          document.removeEventListener('keydown', keydownListener)
        },
        /**
         * #action
         */
        async setPluginsUpdated() {
          const root = self as DesktopRootModel
          if (root.session) {
            await root.saveSession(getSaveSession(root))
          }
          await root.openNewSessionCallback(root.sessionPath)
        },
        /**
         * #action
         */
        activateSession(sessionSnapshot: SnapshotIn<DesktopSessionModelType>) {
          self.setSession(sessionSnapshot)
        },
        /**
         * #action
         */
        setDefaultSession() {
          const { defaultSession } = self.jbrowse
          self.setSession({
            ...defaultSession,
            name: `${defaultSession.name || 'New session'} ${new Date().toLocaleString()}`,
          })
        },
        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          if (self.session) {
            const snapshot = getSnapshot(self.session)
            self.setSession({
              ...snapshot,
              name: sessionName,
            })
          }
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      menus() {
        return processMutableMenuActions(
          [
            {
              label: 'File',
              menuItems: [
                {
                  label: 'Open session...',
                  icon: OpenIcon,
                  onClick: async () => {
                    try {
                      const path = await ipcRenderer.invoke('promptOpenFile')
                      if (path) {
                        await self.openNewSessionCallback(path)
                      }
                    } catch (e) {
                      console.error(e)
                      self.session?.notifyError(`${e}`, e)
                    }
                  },
                },
                {
                  label: 'Save session as...',
                  icon: SaveAsIcon,
                  onClick: async () => {
                    try {
                      self.setSessionPath(
                        await ipcRenderer.invoke('promptSessionSaveAs'),
                      )
                      await self.saveSession(getSaveSession(self))
                    } catch (e) {
                      console.error(e)
                      self.session?.notifyError(`${e}`, e)
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
                      const session = self.session as SessionWithDialogs
                      session.queueDialog(doneCallback => [
                        OpenSequenceDialog,
                        {
                          model: self,
                          onClose: (confs?: AnyConfigurationModel[]) => {
                            try {
                              if (confs) {
                                for (const conf of confs) {
                                  self.jbrowse.addAssemblyConf(conf)
                                }
                              }
                            } catch (e) {
                              console.error(e)
                              self.session?.notifyError(`${e}`, e)
                            }
                            doneCallback()
                          },
                        },
                      ])
                    }
                  },
                },
                getOpenTrackMenuItem(),
                getOpenConnectionMenuItem(),
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
                  onClick: async () => {
                    await ipcRenderer.invoke('quit')
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
                getUndoMenuItem(() => self.history),
                getRedoMenuItem(() => self.history),
                { type: 'divider' },
                getPluginStoreMenuItem(() => self.session),
                {
                  label: 'Preferences',
                  icon: SettingsIcon,
                  onClick: () => {
                    if (self.session) {
                      const session = self.session as SessionWithDialogs
                      session.queueDialog(handleClose => [
                        PreferencesDialog,
                        {
                          session: self.session,
                          handleClose,
                        },
                      ])
                    }
                  },
                },
                {
                  label: 'Open assembly manager',
                  icon: DNA,
                  onClick: () => {
                    if (self.session) {
                      self.session.queueDialog(handleClose => [
                        AssemblyManager,
                        {
                          session: self.session as DesktopSessionModel,
                          onClose: handleClose,
                        },
                      ])
                    }
                  },
                },
              ],
            },
          ] as Menu[],
          self.mutableMenuActions,
        )
      },
    }))
}

export type DesktopRootModelType = ReturnType<typeof rootModelFactory>
export type DesktopRootModel = Instance<DesktopRootModelType>
