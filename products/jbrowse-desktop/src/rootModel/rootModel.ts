import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { DNA } from '@jbrowse/core/ui/Icons'
import { addDisposer, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  openConnectionMenuItem,
  openTrackMenuItem,
  pluginStoreMenuItem,
  preferencesMenuItem,
  workspacesMenuItem,
} from '@jbrowse/product-core'
import AppsIcon from '@mui/icons-material/Apps'
import OpenIcon from '@mui/icons-material/FolderOpen'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import RedoIcon from '@mui/icons-material/Redo'
import SaveAsIcon from '@mui/icons-material/SaveAs'
import UndoIcon from '@mui/icons-material/Undo'
import { autorun } from 'mobx'

import packageJSON from '../../package.json' with { type: 'json' }
import OpenSequenceDialog from '../components/OpenSequenceDialog.tsx'
import jobsModelFactory from '../indexJobsModel.ts'
import JBrowseDesktop from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'
import type { BaseRootModel, BaseSession } from '@jbrowse/product-core'

// lazies
const PreferencesDialog = lazy(
  () => import('@jbrowse/product-core/src/ui/PreferencesDialog'),
)

const { ipcRenderer } = window.require('electron')

function getSaveSession(model: BaseRootModel) {
  const snap = getSnapshot(model.jbrowse)
  return {
    ...(snap as Record<string, unknown>),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
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
  return (
    types
      .compose(
        'JBrowseDesktopRootModel',
        BaseRootModelFactory({
          pluginManager,
          jbrowseModelType,
          sessionModelType,
          assemblyConfigSchema,
        }),
        InternetAccountsRootModelMixin(pluginManager),
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
          { makeWorkerInstance, defaultDriverName: 'WebWorkerRpcDriver' },
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
        async saveSession(val: unknown) {
          if (self.sessionPath) {
            await ipcRenderer.invoke('saveSession', self.sessionPath, val)
          }
        },
      }))
      // separate actions block so saveSession (defined above) is visible on
      // `self` with its real type, rather than casting self to the composed model
      .actions(self => ({
        /**
         * #action
         * Persist the session, then rebuild the plugin manager from disk so the
         * changed plugin set takes effect (Loader wires openNewSessionCallback to
         * reload from the session path).
         */
        async setPluginsUpdated() {
          if (self.session) {
            await self.saveSession(getSaveSession(self))
          }
          await self.openNewSessionCallback(self.sessionPath)
        },
        afterCreate() {
          addDisposer(
            self,
            autorun(
              async () => {
                // capture the session up front so a save failure reports to the
                // same session even if it changed during the awaited save
                const { session } = self
                if (session) {
                  try {
                    await self.saveSession(getSaveSession(self))
                  } catch (e) {
                    console.error(e)
                    session.notifyError(`${e}`, e)
                  }
                }
              },
              { delay: 1000 },
            ),
          )
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
                        const filePath = await ipcRenderer.invoke(
                          'promptSessionSaveAs',
                        )
                        if (filePath) {
                          self.setSessionPath(filePath)
                          await self.saveSession(getSaveSession(self))
                        }
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
                        const session = self.session as BaseSession
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
                  openTrackMenuItem(),
                  openConnectionMenuItem(),
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
                  pluginStoreMenuItem(),
                  preferencesMenuItem(pluginManager, PreferencesDialog),
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
                  workspacesMenuItem(self.session),
                ],
              },
            ],
            self.mutableMenuActions,
          )
        },
      }))
  )
}

export type DesktopRootModelType = ReturnType<typeof rootModelFactory>
export type DesktopRootModel = Instance<DesktopRootModelType>
