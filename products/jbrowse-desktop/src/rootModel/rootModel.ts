import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { Cable, DNA } from '@jbrowse/core/ui/Icons'
import { types } from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
} from '@jbrowse/product-core'
import AppsIcon from '@mui/icons-material/Apps'
import ExtensionIcon from '@mui/icons-material/Extension'
import OpenIcon from '@mui/icons-material/FolderOpen'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import RedoIcon from '@mui/icons-material/Redo'
import SaveAsIcon from '@mui/icons-material/SaveAs'
import SettingsIcon from '@mui/icons-material/Settings'
import StorageIcon from '@mui/icons-material/Storage'
import UndoIcon from '@mui/icons-material/Undo'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'

import { DesktopSessionManagementMixin, getSaveSession } from './Sessions'
import packageJSON from '../../package.json'
import OpenSequenceDialog from '../components/OpenSequenceDialog'
import jobsModelFactory from '../indexJobsModel'
import JBrowseDesktop from '../jbrowseModel'
import makeWorkerInstance from '../makeWorkerInstance'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'
import type { SessionWithDialogs } from '@jbrowse/product-core'

// lazies
const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))

const { ipcRenderer } = window.require('electron')

export interface Menu {
  label: string
  menuItems: MenuItem[]
}

type SessionModelFactory = (args: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) => IAnyType

/**
 * #stateModel JBrowseDesktopRootModel
 * #category root
 * composed of
 * - [BaseRootModel](../baserootmodel)
 * - [InternetAccountsMixin](../internetaccountsmixin)
 * - [DesktopSessionManagementMixin](../desktopsessionmanagementmixin)
 * - [HistoryManagementMixin](../historymanagementmixin)
 * - [RootAppMenuMixin](../rootappmenumixin)
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
      InternetAccountsRootModelMixin(pluginManager),
      DesktopSessionManagementMixin(pluginManager),
      HistoryManagementMixin(),
      RootAppMenuMixin(),
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
    }))
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
                {
                  label: 'Open track...',
                  icon: StorageIcon,

                  onClick: (session: any) => {
                    if (session.views.length === 0) {
                      session.notify('Please open a view to add a track first')
                    } else if (session.views.length > 0) {
                      const widget = session.addWidget(
                        'AddTrackWidget',
                        'addTrackWidget',
                        { view: session.views[0].id },
                      )
                      session.showWidget(widget)
                      if (session.views.length > 1) {
                        session.notify(
                          'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right',
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
                {
                  label: 'Undo',
                  icon: UndoIcon,
                  onClick: () => {
                    if (self.history.canUndo) {
                      self.history.undo()
                    }
                  },
                },
                {
                  label: 'Redo',
                  icon: RedoIcon,
                  onClick: () => {
                    if (self.history.canRedo) {
                      self.history.redo()
                    }
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
                {
                  label: 'Use workspaces',
                  icon: SpaceDashboardIcon,
                  type: 'checkbox',
                  checked: self.session?.useWorkspaces ?? false,
                  helpText:
                    'Workspaces allow you to organize views into tabs and tiles. You can drag views between tabs or split them side-by-side.',
                  onClick: () => {
                    self.session?.setUseWorkspaces(!self.session.useWorkspaces)
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
