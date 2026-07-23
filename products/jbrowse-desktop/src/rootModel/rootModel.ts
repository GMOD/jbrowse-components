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
  redoMenuItem,
  undoMenuItem,
  workspacesMenuItem,
} from '@jbrowse/product-core'
import AppsIcon from '@mui/icons-material/Apps'
import DescriptionIcon from '@mui/icons-material/Description'
import OpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import PublicIcon from '@mui/icons-material/Public'
import SaveAsIcon from '@mui/icons-material/SaveAs'
import { autorun } from 'mobx'

import packageJSON from '../../package.json' with { type: 'json' }
import OpenSequenceDialog from '../components/OpenSequenceDialog.tsx'
import jobsModelFactory from '../indexJobsModel.ts'
import JBrowseDesktop from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'

import type { AppRootModel } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'
import type { BaseRootModel, BaseSession } from '@jbrowse/product-core'

// lazies
const PreferencesDialog = lazy(
  () => import('@jbrowse/product-core/src/ui/PreferencesDialog'),
)
const ExportToWebDialog = lazy(
  () => import('../components/ExportToWebDialog.tsx'),
)
const OpenLinkDialog = lazy(() => import('../components/OpenLinkDialog.tsx'))

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
        openLinkCallback: async (_link: string) => {
          console.error('openLinkCallback unimplemented')
        },
        returnToStartScreenCallback: () => {
          console.error('returnToStartScreenCallback unimplemented')
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
         * Wired by the Loader to open a JBrowse Web link as a new session (the
         * Loader owns plugin-manager lifecycle, as with openNewSessionCallback).
         */
        setOpenLinkCallback(cb: (arg: string) => Promise<void>) {
          self.openLinkCallback = cb
        },
        /**
         * #action
         * Wired by the Loader to tear down this plugin manager and show the
         * start screen (the Loader owns plugin-manager lifecycle).
         */
        setReturnToStartScreenCallback(cb: () => void) {
          self.returnToStartScreenCallback = cb
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
          // openNewSessionCallback reloads from sessionPath; with no path there
          // is nothing to reload from (loadSession('') would throw)
          if (self.sessionPath) {
            if (self.session) {
              await self.saveSession(getSaveSession(self))
            }
            await self.openNewSessionCallback(self.sessionPath)
          }
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
                    label: 'Open genome...',
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
                  {
                    type: 'divider',
                  },
                  {
                    label: 'Session',
                    icon: DescriptionIcon,
                    subMenu: [
                      {
                        label: 'Open config.json or .jbrowse file...',
                        icon: OpenIcon,
                        onClick: async () => {
                          try {
                            const path =
                              await ipcRenderer.invoke('promptOpenFile')
                            if (path) {
                              await self.openNewSessionCallback(path)
                            }
                          } catch (e) {
                            console.error(e)
                            self.session?.notifyError(`${e}`, e)
                          }
                        },
                      },
                      // A session can also come from a JBrowse Web link (the
                      // docs' figure links), so it opens alongside the file
                      // that is its closest equivalent. The dialog reports its
                      // own errors, hence no try/catch here.
                      {
                        label: 'Open JBrowse Web link...',
                        icon: LinkIcon,
                        onClick: () => {
                          if (self.session) {
                            const session = self.session as BaseSession
                            session.queueDialog(handleClose => [
                              OpenLinkDialog,
                              {
                                onSubmit: self.openLinkCallback,
                                onClose: handleClose,
                              },
                            ])
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
                        label: 'Export session to web...',
                        icon: PublicIcon,
                        onClick: () => {
                          const session = self.session as
                            | BaseSession
                            | undefined
                          if (session) {
                            session.queueDialog(doneCallback => [
                              ExportToWebDialog,
                              {
                                snapshot: getSaveSession(self),
                                session,
                                handleClose: () => {
                                  doneCallback()
                                },
                              },
                            ])
                          }
                        },
                      },
                    ],
                  },
                  openConnectionMenuItem(),
                  {
                    type: 'divider',
                  },
                  {
                    label: 'Return to start screen',
                    icon: AppsIcon,
                    onClick: async () => {
                      // flush a final save so edits still inside the autosave
                      // debounce window aren't lost, then let the Loader tear
                      // down this plugin manager (workers + autosave) rather
                      // than leaving it orphaned behind the start screen
                      const session = self.session as BaseSession | undefined
                      if (session) {
                        try {
                          await self.saveSession(getSaveSession(self))
                        } catch (e) {
                          console.error(e)
                          session.notifyError(`${e}`, e)
                        }
                      }
                      self.returnToStartScreenCallback()
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
                  undoMenuItem(self.history),
                  redoMenuItem(self.history),
                  { type: 'divider' },
                  pluginStoreMenuItem(),
                  preferencesMenuItem(pluginManager, PreferencesDialog),
                  {
                    label: 'Open assembly manager',
                    icon: DNA,
                    onClick: () => {
                      ;(self.session as BaseSession).queueDialog(
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

// Verify DesktopRootModel satisfies AppRootModel at compile time. If this
// errors, the root model is missing something the app session layer
// (AppSessionMixin) delegates to via self.root.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _checkDesktopRootModel(m: DesktopRootModel): AppRootModel {
  return m
}
