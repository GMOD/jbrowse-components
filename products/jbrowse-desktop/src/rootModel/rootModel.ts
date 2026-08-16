import { lazy } from 'react'

import {
  HistoryManagementMixin,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaF from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
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
import jobsModelFactory from '../indexJobsModel.ts'
import { invokeIpc } from '../ipc.ts'
import JBrowseDesktop from '../jbrowseModel.ts'
import makeWorkerInstance from '../makeWorkerInstance.ts'

import type { SessionSnap } from '../../electron/ipc/channelTypes.ts'
import type { AppRootModel, SessionModelFactory } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { DialogComponentType } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { BaseRootModel, BaseSession } from '@jbrowse/product-core'

// lazies. A dialog reached through session.queueDialog can always be one:
// DialogQueue Suspense-wraps whatever it is handed. OpenSequenceDialog was the
// last one named directly here, which put AddGenomePane and the assembly-config
// builders in the root model — as eager a module as this app has.
const PreferencesDialog = lazy(
  () => import('../components/PreferencesDialog.tsx'),
)
const OpenSequenceDialog = lazy(
  () => import('../components/OpenSequenceDialog.tsx'),
)
const ExportToWebDialog = lazy(
  () => import('../components/ExportToWebDialog.tsx'),
)
const OpenLinkDialog = lazy(() => import('../components/OpenLinkDialog.tsx'))

// Add a whole batch of assemblies, or none of it. Every name is checked before
// anything is added because jbrowse.addAssemblyConf throws on a duplicate, and a
// loop that added as it went would open the genomes before the collision, drop
// the ones after it, and report one error for all three.
function addAssemblyConfs(
  jbrowse: {
    assemblyNames: string[]
    addAssemblyConf: (conf: AnyConfigurationModel) => unknown
  },
  confs: AnyConfigurationModel[],
) {
  const taken = confs
    .map(conf => String(conf.name))
    .filter(name => jbrowse.assemblyNames.includes(name))
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
// console, then surfaced in the session's notification area. Structurally typed
// so both `self.session` and a BaseSession-narrowed one pass without a cast.
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
// guard, since a root can be between sessions. The guard is what kept differing
// between them — "Open assembly manager" asserted rather than checked, so a
// click with no session would have thrown out of the menu handler.
//
// `build` returns what BaseSession.queueDialog takes, a component plus loose
// props, rather than tying the props to the component with a generic. The
// generic is what a helper here invites and it does not hold: these props do not
// typecheck against their own components (the assembly manager and the web
// export want an AbstractSessionModel where this has the narrower BaseSession,
// and the sequence dialog's onClose is declared over AssemblyConf rather than
// AnyConfigurationModel), so it would only move those mismatches out of the
// session layer and into this file.
function queueSessionDialog(
  maybeSession: unknown,
  build: (
    session: BaseSession,
    doneCallback: () => void,
  ) => [DialogComponentType, Record<string, unknown>],
) {
  const session = maybeSession as BaseSession | undefined
  if (session) {
    session.queueDialog(doneCallback => build(session, doneCallback))
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
        /**
         * #volatile
         * What has to stop the moment the Loader lets go of this root — here,
         * the autosave autorun, which writes to disk over IPC.
         *
         * Not `addDisposer`, which fires only on destroy, and the destroy is
         * now a task later than the swap. An autosave left running in that gap
         * writes the *outgoing* session to `sessionPath`, which the replacement
         * has already been loaded from. See `detach`.
         */
        detachDisposers: [] as (() => void)[],
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
         * Register something that must stop when the Loader detaches this root.
         * See the `detachDisposers` volatile for why this is not `addDisposer`.
         */
        addDetachDisposer(disposer: () => void) {
          self.detachDisposers.push(disposer)
        },
        /**
         * #action
         * The Loader has let go of this root: stop everything of ours that
         * reaches outside the tree — the worker pool and the autosave autorun —
         * and leave the tree itself alone.
         *
         * Half the teardown. The caller destroys the tree on a later task
         * (`scheduleDetachedDestroy`), which is what runs the `beforeDestroy`
         * hooks in it — a plugin-facing contract, so skipping it is not an
         * option. What this action does is take everything reaching outside the
         * tree off that deferral, so nothing keeps running in between. ADR-069.
         */
        detach() {
          // rpcManager is a plain object on a volatile, so MST teardown never
          // reached it
          self.rpcManager.destroy()
          const disposers = self.detachDisposers
          self.detachDisposers = []
          for (const disposer of disposers) {
            disposer()
          }
        },
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
            await invokeIpc('saveSession', self.sessionPath, val)
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
                menuItems: [
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
                          onClose: (confs?: AnyConfigurationModel[]) => {
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
