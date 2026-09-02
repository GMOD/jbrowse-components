import { lazy } from 'react'

import {
  JBrowseModelF,
  RootAppMenuMixin,
  processMutableMenuActions,
} from '@jbrowse/app-core'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { dedupePlugins } from '@jbrowse/core/pluginDefinitions'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import {
  BaseRootModelFactory,
  InternetAccountsRootModelMixin,
  exportSessionMenuItem,
  getShareableSessionSnapshot,
  importSessionMenuItem,
  newSessionMenuItem,
  openConnectionMenuItem,
  openTrackMenuItem,
  preferencesMenuItem,
  workspacesMenuItem,
} from '@jbrowse/product-core'
import { autorun } from 'mobx'

import { version } from '../version.ts'

import type { SessionModelFactory } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { SessionSnapshot } from '@jbrowse/product-core'
import type { AbstractWebRootModel } from '@jbrowse/web-core'

// lazy for the same reason web and desktop do it: the dialog is reached through
// session.queueDialog, which Suspense-wraps whatever it is handed, so there is
// no reason for its MUI form controls to sit in the root model's eager graph
const PreferencesDialog = lazy(() => import('./PreferencesDialogReExport.tsx'))

/**
 * What a host needs to rebuild the app after its plugin set changed: the
 * plugins to `loadPlugins`, and the session to hand back as `session` so the
 * user lands where they were.
 */
export interface PluginsUpdate {
  plugins: PluginDefinition[]
  session: SessionSnapshot | undefined
}

/**
 * #stateModel JBrowseReactAppRootModel
 *
 * note: many properties of the root model are available through the session,
 * and we generally prefer using the session model (via e.g. getSession) over
 * the root model (via e.g. getRoot) in plugin code
 */
export default function RootModel({
  pluginManager,
  sessionModelFactory,
  makeWorkerInstance,
}: {
  pluginManager: PluginManager
  sessionModelFactory: SessionModelFactory
  makeWorkerInstance?: () => Worker
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  return types
    .compose(
      BaseRootModelFactory({
        pluginManager,
        jbrowseModelType: JBrowseModelF({
          pluginManager,
          assemblyConfigSchema,
        }),
        sessionModelType: sessionModelFactory({
          pluginManager,
          assemblyConfigSchema,
        }),
        assemblyConfigSchema,
        rpcManagerOptions: {
          makeWorkerInstance,
          // when a worker factory is supplied, run RPC off the main thread by
          // default; config `defaultDriver` still overrides this
          defaultDriverName: makeWorkerInstance
            ? 'WebWorkerRpcDriver'
            : 'MainThreadRpcDriver',
        },
      }),
      InternetAccountsRootModelMixin(pluginManager),
      RootAppMenuMixin(),
    )

    .volatile(() => ({
      /**
       * #volatile
       */
      version,
      /**
       * #volatile
       */
      pluginsUpdated: false,
      /**
       * #volatile
       * host hook for {@link PluginsUpdated}, set from createViewState's
       * `onPluginsUpdated`. Undefined means the host didn't ask to handle it.
       */
      pluginsUpdatedCallback: undefined as
        | ((args: PluginsUpdate) => void)
        | undefined,
    }))
    .actions(self => {
      // pluginsUpdated latches true and this root lives on, so without this any
      // later session edit would re-notify (or re-invoke the host) forever
      let handled = false
      return {
        afterCreate() {
          addDisposer(
            self,
            autorun(
              function pluginsUpdatedAutorun() {
                if (self.pluginsUpdated && !handled) {
                  handled = true
                  // A plugin set can only change by rebuilding the plugin
                  // manager, and this app cannot do that for itself: it never
                  // fetches plugins (loadPlugins is the host's call, since
                  // createViewState is synchronous), and it does not own the
                  // React tree it is mounted into. jbrowse-web rebuilds its own
                  // loader here; an embedded component doing the equivalent —
                  // window.location.reload() — would reload the *host's* page
                  // and, with no autosave behind it, lose the whole session.
                  //
                  // So hand the host what a rebuild needs (the plugins to load,
                  // the session to restore) and let it remount. With no host
                  // hook, say so rather than doing something destructive.
                  if (self.pluginsUpdatedCallback) {
                    const { session } = self
                    self.pluginsUpdatedCallback({
                      plugins: dedupePlugins([
                        ...self.jbrowse.plugins,
                        ...(session?.sessionPlugins ?? []),
                      ]),
                      // `name` is restated so this satisfies SessionSnapshot:
                      // the bake returns an open record, but the model
                      // guarantees the session has one
                      session: session
                        ? {
                            ...getShareableSessionSnapshot(session),
                            name: session.name,
                          }
                        : undefined,
                    })
                  } else {
                    self.session?.notify(
                      'Plugin changes take effect the next time this page loads',
                      'info',
                    )
                  }
                }
              },
              { name: 'PluginsUpdated' },
            ),
          )
        },
        /**
         * #action
         */
        setPluginsUpdated() {
          self.pluginsUpdated = true
        },
        /**
         * #action
         */
        setPluginsUpdatedCallback(callback: (args: PluginsUpdate) => void) {
          self.pluginsUpdatedCallback = callback
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
              menuItems: () => [
                newSessionMenuItem(self),
                importSessionMenuItem(),
                exportSessionMenuItem(),
                { type: 'divider' },
                openTrackMenuItem(),
                openConnectionMenuItem(),
              ],
            },
            {
              label: 'Add',
              menuItems: () => [],
            },
            {
              label: 'Tools',
              menuItems: () => [
                preferencesMenuItem(pluginManager, PreferencesDialog),
                workspacesMenuItem(self.session),
              ],
            },
          ],
          self.mutableMenuActions,
        )
      },
    }))
}

export type WebRootModelType = ReturnType<typeof RootModel>
export type WebRootModel = Instance<WebRootModelType>

// Verify the react-app root satisfies AbstractWebRootModel at compile time.
// react-app is a reduced web root: it deliberately omits undo/redo history and
// the saved-session database (AbstractWebSessionDbRootModel), so it satisfies
// only the narrow contract its session (BaseWebSession, without the management
// mixin) requires.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _checkReactAppRootModel(m: WebRootModel): AbstractWebRootModel {
  return m
}
