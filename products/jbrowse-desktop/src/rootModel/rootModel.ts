import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  aboutMenuItem,
  helpMenuItem,
  processMutableMenuActions,
  summarizeSession,
} from '@jbrowse/app-core'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { DNA, Indexing } from '@jbrowse/core/ui/Icons'
import {
  addDisposer,
  applySnapshot,
  getSnapshot,
  types,
} from '@jbrowse/mobx-state-tree'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  hydratedForms,
  openConnectionMenuItem,
  openTrackMenuItem,
  pluginStoreMenuItem,
  preferencesMenuItem,
  redoMenuItem,
  undoMenuItem,
} from '@jbrowse/product-core'
import AppsIcon from '@mui/icons-material/Apps'
import DescriptionIcon from '@mui/icons-material/Description'
import OpenIcon from '@mui/icons-material/FolderOpen'
import LinkIcon from '@mui/icons-material/Link'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import PublicIcon from '@mui/icons-material/Public'
import SaveAsIcon from '@mui/icons-material/SaveAs'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import UpdateIcon from '@mui/icons-material/Update'
import { autorun } from 'mobx'

import packageJSON from '../../package.json' with { type: 'json' }
import jobsModelFactory from '../indexJobsModel.ts'
import { invokeIpc } from '../ipc.ts'
import JBrowseDesktop from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'

import type { SessionSnap } from '../../electron/ipc/channelTypes.ts'
import type { AppRootModel, SessionModelFactory } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfiguration } from '@jbrowse/core/configuration'
import type { AssemblyConf } from '@jbrowse/core/util/assemblyConfigUtils'
import type {
  AbstractSessionModel,
  DialogComponentType,
} from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  BaseRootModel,
  SessionWithSessionTracks,
} from '@jbrowse/product-core'
import type React from 'react'

// lazies. A dialog reached through session.queueDialog can always be one:
// DialogQueue Suspense-wraps whatever it is handed. OpenSequenceDialog was the
// last one named directly here, which put AddGenomePane and the assembly-config
// builders in the root model — as eager a module as this app has.
const OpenSequenceDialog = lazy(
  () => import('../components/OpenSequenceDialog.tsx'),
)
const ExportToWebDialog = lazy(
  () => import('../components/ExportToWebDialog.tsx'),
)
const OpenLinkDialog = lazy(() => import('../components/OpenLinkDialog.tsx'))

// Add a whole batch of assemblies, or none of it. Every name is checked before
// anything is added because jbrowse.addAssemblyConf throws on a name or alias it
// already holds, and a loop that added as it went would open the genomes before
// the collision, drop the ones after it, and report one error for all three.
function addAssemblyConfs(
  jbrowse: {
    assemblies: { name: string; aliases: string[] }[]
    addAssemblyConf: (conf: AnyConfiguration) => unknown
  },
  confs: AssemblyConf[],
) {
  const taken = confs
    .map(conf => conf.name)
    .filter(name =>
      jbrowse.assemblies.some(a => a.name === name || a.aliases.includes(name)),
    )
  if (taken.length) {
    throw new Error(
      `An assembly is already open under ${taken.length > 1 ? 'these names' : 'this name'}: ${taken.join(', ')}. Rename and try again.`,
    )
  }
  for (const conf of confs) {
    jbrowse.addAssemblyConf(conf)
  }
}

function getSaveSession(model: BaseRootModel): SessionSnap {
  const snap = getSnapshot(model.jbrowse)
  return {
    ...(snap as Record<string, unknown>),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
}

// Every menu action that can throw reports the same way: logged for the devtools
// console, then surfaced in the session's notification area.
function reportError(
  session:
    | { notifyError: (message: string, error: unknown) => void }
    | undefined,
  e: unknown,
) {
  console.error(e)
  session?.notifyError(`${e}`, e)
}

// Four of the menu items below open a dialog, and each needs the same two things
// first: `self.session` narrowed to the type that carries queueDialog, and a
// guard, since a root can be between sessions.
function queueSessionDialog<T extends DialogComponentType>(
  maybeSession: unknown,
  build: (
    session: AbstractSessionModel,
    doneCallback: () => void,
  ) => [T, React.ComponentProps<T>],
) {
  const session = maybeSession as AbstractSessionModel | undefined
  if (session) {
    session.queueDialog(doneCallback => build(session, doneCallback))
  }
}

/**
 * #stateModel JBrowseDesktopRootModel
 * #category root
 *
 * Holds JBrowse Desktop's top-level state: the loaded config, the session,
 * internet accounts, undo history, the app menus and the text-indexing jobs.
 *
 * Many properties of the root model are available through the session, and
 * we generally prefer using the session model (via e.g. `getSession`) over the
 * root model (via e.g. `getRoot`) in plugin code.
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
  const JobsManager = jobsModelFactory()
  return (
    types
      .compose(
        'JBrowseDesktopRootModel',
        BaseRootModelFactory({
          pluginManager,
          jbrowseModelType,
          sessionModelType,
          assemblyConfigSchema,
          rpcManagerOptions: {
            makeWorkerInstance,
            defaultDriverName: 'WebWorkerRpcDriver',
          },
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
      .volatile(() => ({
        version: packageJSON.version,
        adminMode: true,
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
        async saveSession(val: SessionSnap) {
          if (self.sessionPath) {
            await invokeIpc(
              'saveSession',
              self.sessionPath,
              val,
              summarizeSession(val.defaultSession),
            )
          }
        },
        /**
         * #action
         * Replace a track's base config: its sessionTracks entry when the
         * session owns the track, otherwise its jbrowse.tracks entry.
         */
        updateTrackBase(trackConf: {
          trackId: string
          [key: string]: unknown
        }) {
          const session: SessionWithSessionTracks | undefined = self.session
          const entry = session?.sessionTracks.find(
            t => t.trackId === trackConf.trackId,
          )
          if (entry) {
            applySnapshot(entry, trackConf)
          } else {
            self.jbrowse.updateTrackConf(trackConf)
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
          const { session, sessionPath } = self
          if (!sessionPath) {
            return
          }
          // reported here: the plugin store's add and remove drop this promise,
          // and a reload that fails leaves this session open to report it
          try {
            if (session) {
              await self.saveSession(getSaveSession(self))
            }
            await self.openNewSessionCallback(sessionPath)
          } catch (e) {
            reportError(session, e)
          }
        },
        /**
         * #action
         * Save now rather than waiting out the autosave's 1s debounce, so the
         * last second of edits survives. Every path that tears the session down
         * — quitting, returning to the start screen — has to call this first;
         * Exit did not, and lost whatever was still inside the debounce window.
         */
        async flushSession() {
          // capture the session up front so a save failure reports to the same
          // session even if it changed during the awaited save
          const { session } = self
          if (session) {
            try {
              await self.saveSession(getSaveSession(self))
            } catch (e) {
              reportError(session, e)
            }
          }
        },
        afterCreate() {
          // on detach AND on destroy: detach is what the Loader performs, and
          // the destroy that follows it a task later is what a test that builds
          // a root directly does instead. Running a disposer twice is harmless.
          const registerTeardown = (disposer: () => void) => {
            self.addDetachDisposer(disposer)
            addDisposer(self, disposer)
          }
          registerTeardown(
            autorun(
              async () => {
                // NOT `await this.flushSession()`, tempting as the reuse is: an
                // MST action runs untracked, so the snapshot reads would happen
                // where this autorun cannot see them and it would fire exactly
                // once, silently ending autosave. The reads have to stay here,
                // and getSaveSession has to be evaluated before saveSession (an
                // action) is entered.
                const { session } = self
                if (session) {
                  const snap = getSaveSession(self)
                  try {
                    await self.saveSession(snap)
                  } catch (e) {
                    reportError(session, e)
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
                menuItems: () => [
                  {
                    label: 'Open genome...',
                    icon: DNA,
                    onClick: () => {
                      queueSessionDialog(self.session, (_session, done) => [
                        OpenSequenceDialog,
                        {
                          existingAssemblyNames: [
                            ...self.jbrowse.assemblyNames,
                          ],
                          // deliberately unguarded: a throw here leaves the
                          // dialog open showing the reason, with the staged
                          // genomes still in it. Catching would report the
                          // failure to a snackbar and close over work that has
                          // nowhere left to go.
                          onClose: async (confs?: AssemblyConf[]) => {
                            if (confs) {
                              addAssemblyConfs(self.jbrowse, confs)
                            }
                            done()
                          },
                        },
                      ])
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
                            const path = await invokeIpc('promptOpenFile')
                            if (path) {
                              // no flush here: the swap behind this callback
                              // flushes between loading the replacement and
                              // installing it, which also covers whatever is
                              // edited while the load is in flight. Flushing
                              // first, as this used to, covered only up to the
                              // click. See useSessionSwap.
                              await self.openNewSessionCallback(path)
                            }
                          } catch (e) {
                            reportError(self.session, e)
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
                          queueSessionDialog(
                            self.session,
                            (_session, handleClose) => [
                              OpenLinkDialog,
                              {
                                // not flushed here for the same reason opening
                                // a file above is not: the swap behind the
                                // callback does it at the moment of
                                // replacement. A rejection reaches the dialog,
                                // which reports it inline and stays open.
                                onSubmit: async (link: string) => {
                                  await self.openLinkCallback(link)
                                },
                                onClose: handleClose,
                              },
                            ],
                          )
                        },
                      },
                      {
                        label: 'Save session as...',
                        icon: SaveAsIcon,
                        onClick: async () => {
                          try {
                            const filePath = await invokeIpc(
                              'promptSessionSaveAs',
                            )
                            if (filePath) {
                              self.setSessionPath(filePath)
                              await self.saveSession(getSaveSession(self))
                            }
                          } catch (e) {
                            reportError(self.session, e)
                          }
                        },
                      },
                      {
                        label: 'Export session to web...',
                        icon: PublicIcon,
                        onClick: () => {
                          queueSessionDialog(self.session, (session, done) => [
                            ExportToWebDialog,
                            {
                              snapshot: getSaveSession(self),
                              session,
                              forms: hydratedForms(
                                pluginManager,
                                assemblyConfigSchema,
                              ),
                              handleClose: () => {
                                done()
                              },
                            },
                          ])
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
                      await self.flushSession()
                      self.returnToStartScreenCallback()
                    },
                  },
                  {
                    label: 'Exit',
                    icon: MeetingRoomIcon,
                    onClick: async () => {
                      // quitting destroys the window, so the pending debounced
                      // autosave would never run: flush first, exactly as
                      // returning to the start screen above does
                      await self.flushSession()
                      await invokeIpc('quit')
                    },
                  },
                ],
              },
              {
                label: 'Add',
                menuItems: () => [],
              },
              {
                label: 'Tools',
                menuItems: () => [
                  undoMenuItem(self.history),
                  redoMenuItem(self.history),
                  { type: 'divider' },
                  pluginStoreMenuItem(),
                  preferencesMenuItem(pluginManager),
                  {
                    label: 'Open assembly manager',
                    icon: DNA,
                    onClick: () => {
                      queueSessionDialog(
                        self.session,
                        (session, handleClose) => [
                          AssemblyManager,
                          {
                            session,
                            onClose: handleClose,
                          },
                        ],
                      )
                    },
                  },
                  {
                    label: 'Jobs list',
                    icon: Indexing,
                    onClick: () => {
                      self.session.showWidget(
                        self.jobsManager.getJobStatusWidget(),
                      )
                    },
                  },
                ],
              },
              // The native menu bar exists on macOS alone (electron/window.ts
              // sets it to null elsewhere), so on Windows and Linux these are
              // the only route to the update check and the MCP setup text.
              {
                label: 'Help',
                menuItems: () => [
                  aboutMenuItem(),
                  helpMenuItem(),
                  {
                    label: 'Check for updates...',
                    icon: UpdateIcon,
                    onClick: () => {
                      // every outcome is a native dialog raised by the main
                      // process, so there is nothing to await or to report
                      invokeIpc('checkForUpdates').catch((e: unknown) => {
                        reportError(self.session, e)
                      })
                    },
                  },
                  {
                    label: 'Connect an AI agent...',
                    icon: SmartToyIcon,
                    onClick: () => {
                      invokeIpc('showConnectAgent').catch((e: unknown) => {
                        reportError(self.session, e)
                      })
                    },
                  },
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
