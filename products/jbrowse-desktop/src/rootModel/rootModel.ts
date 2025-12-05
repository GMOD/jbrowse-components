import { lazy } from 'react'

import {
  getOpenConnectionMenuItem,
  getOpenTrackMenuItem,
  getPluginStoreMenuItem,
  getRedoMenuItem,
  getUndoMenuItem,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { DNA } from '@jbrowse/core/ui/Icons'
import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import { BaseRootModelFactory } from '@jbrowse/product-core'
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

import type { Menu, MenuAction, SessionModelFactory } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel, UriLocation } from '@jbrowse/core/util'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { BaseSession, SessionWithDialogs } from '@jbrowse/product-core'

// lazies
const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))

const { ipcRenderer } = window.require('electron')

export function getSaveSession(model: {
  jbrowse: Record<string, unknown>
  session: Record<string, unknown> | undefined
}) {
  const snap = getSnapshot(model.jbrowse)
  return {
    ...(snap as Record<string, unknown>),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
}

/**
 * #stateModel JBrowseDesktopRootModel
 * #category root
 * composed of
 * - [BaseRootModel](../baserootmodel)
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function rootModelFactory({
  pluginManager,
  sessionModelFactory,
}: {
  pluginManager: PluginManager
  sessionModelFactory: SessionModelFactory
}) {
  const assemblyConfigSchema = assemblyConfigSchemaF(pluginManager)
  const sessionModelType = sessionModelFactory({
    pluginManager,
    assemblyConfigSchema,
  })
  const jbrowseModelType = JBrowseDesktop(pluginManager, assemblyConfigSchema)
  const JobsManager = jobsModelFactory(pluginManager)
  return types
    .compose(
      'JBrowseDesktopRootModel',
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType,
        sessionModelType,
        assemblyConfigSchema,
      }),
      types.model({
        // InternetAccountsRootModelMixin property
        internetAccounts: types.array(
          pluginManager.pluggableMstType('internet account', 'stateModel'),
        ),
        // HistoryManagementMixin property
        history: types.optional(TimeTraveller, { targetPath: '../session' }),
        // DesktopSessionManagementMixin property
        sessionPath: types.optional(types.string, ''),
      }),
    )
    .props({
      /**
       * #property
       */
      jobsManager: types.optional(JobsManager, {}),
    })
    .volatile(self => ({
      version: packageJSON.version,
      adminMode: true,
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { makeWorkerInstance },
          MainThreadRpcDriver: {},
        },
      ),
      openNewSessionCallback: async (_path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
      // RootAppMenuMixin volatile
      mutableMenuActions: [] as MenuAction[],
    }))
    .actions(self => ({
      /**
       * #action
       */
      setOpenNewSessionCallback(cb: (arg: string) => Promise<void>) {
        self.openNewSessionCallback = cb
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

      // InternetAccountsRootModelMixin actions
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

      // DesktopSessionManagementMixin actions
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
      activateSession(sessionSnapshot: SnapshotIn<BaseSession>) {
        const { setSession } = self as typeof self & {
          setSession: (arg: unknown) => void
        }
        setSession(sessionSnapshot)
      },

      // RootAppMenuMixin actions
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
      // HistoryManagementMixin keyboard listener
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
          // HistoryManagementMixin setup
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

          // InternetAccountsRootModelMixin setup
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

          // DesktopSessionManagementMixin setup
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
                    ;(self.session as AbstractSessionModel).queueDialog(
                      handleClose => [
                        AssemblyManager,
                        {
                          session: self.session,
                          onClose: handleClose,
                        },
                      ],
                    )
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
