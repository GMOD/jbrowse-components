import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, types } from '@jbrowse/mobx-state-tree'
import {
  InternetAccountsRootModelMixin,
  createConfigModel,
} from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyModelType, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { SessionSnapshot } from '@jbrowse/product-core'

// every embedded session is composed from product-core's BaseSessionModel, which
// provides setName; requiring it here lets renameCurrentSession rename in place
// instead of rebuilding the session from a snapshot
interface SessionWithSetName {
  setName: (name: string) => void
}

// A session snapshot naming a view type that is registered with a lazy state
// model loader cannot be cast synchronously; without this check, MST reports a
// union mismatch that reads like a corrupt snapshot instead of a missing
// preload. Walks nested views the same way PluginManager.preloadViewTypes
// does.
function assertViewTypesLoaded(
  pluginManager: PluginManager,
  snapshot: unknown,
) {
  const unloaded = new Set<string>()
  const collect = (views: unknown) => {
    if (Array.isArray(views)) {
      for (const view of views) {
        if (view && typeof view === 'object') {
          const { type, views: children } = view as {
            type?: unknown
            views?: unknown
          }
          if (
            typeof type === 'string' &&
            pluginManager.getElementTypeRecord('view').has(type) &&
            !pluginManager.getViewType(type).isStateModelLoaded
          ) {
            unloaded.add(type)
          }
          collect(children)
        }
      }
    }
  }
  if (snapshot && typeof snapshot === 'object') {
    const { view, views } = snapshot as { view?: unknown; views?: unknown }
    collect(views)
    collect(view ? [view] : undefined)
  }
  if (unloaded.size > 0) {
    throw new Error(
      `session names lazily loaded view types that are not loaded yet: ${[...unloaded].join(', ')}. Await pluginManager.preloadViewTypes(snapshot) before setting the session`,
    )
  }
}

/**
 * #stateModel EmbeddedRootModel
 * #category root
 * Root model shared by the single-view embedded products
 * (react-linear-genome-view, react-circular-genome-view). Each product supplies
 * its own model name, version, and session model, and may `.props()` on extra
 * fields (e.g. the LGV `disableAddTracks`/`drawerViewHeight`). Internet accounts
 * come from the same product-core mixin the web/desktop root models use, so
 * config `internetAccounts` are auto-initialized (no manual wiring needed).
 */
export function createEmbeddedRootModel<
  SESSION extends IAnyModelType & { Type: SessionWithSetName },
>({
  name,
  version,
  pluginManager,
  sessionModelType,
  makeWorkerInstance,
}: {
  name: string
  version: string
  pluginManager: PluginManager
  sessionModelType: SESSION
  makeWorkerInstance?: () => Worker
}) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  return types.compose(
    name,
    types
      .model({
        /**
         * #property
         */
        config: createConfigModel(pluginManager, assemblyConfigSchema),
        /**
         * #property
         */
        session: sessionModelType,
        /**
         * #property
         */
        assemblyManager: types.optional(
          assemblyManagerFactory(assemblyConfigSchema, pluginManager),
          {},
        ),
      })
      .volatile(self => ({
        /**
         * #volatile
         */
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        error: undefined as unknown,
        /**
         * #volatile
         */
        adminMode: false,
        /**
         * #volatile
         */
        version,
        /**
         * #volatile
         */
        rpcManager: new RpcManager(
          pluginManager,
          self.config.configuration.rpc,
          {
            makeWorkerInstance,
            // when a worker factory is supplied, run RPC off the main thread by
            // default; config `defaultDriver` still overrides this
            defaultDriverName: makeWorkerInstance
              ? 'WebWorkerRpcDriver'
              : 'MainThreadRpcDriver',
          },
        ),
        /**
         * #volatile
         */
        textSearchManager: new TextSearchManager(pluginManager),
      }))
      .actions(self => ({
        /**
         * #action
         * Synchronous, so every view type the snapshot names must have its
         * state model loaded — the guard turns what would otherwise be a
         * confusing union mismatch into an actionable error. An async caller
         * can `await pluginManager.preloadViewTypes(snapshot)` first.
         */
        setSession(sessionSnapshot: SnapshotIn<SESSION>) {
          assertViewTypesLoaded(pluginManager, sessionSnapshot)
          self.session = cast(sessionSnapshot)
        },
        /**
         * #action
         * Load a session whose shape is only known at runtime — decoded from a
         * URL, read back from storage, handed over by a non-TypeScript host.
         *
         * Separate from `setSession` because that one takes the compiler-checked
         * snapshot type, which a value parsed out of JSON can never satisfy.
         * The assertion below is the whole reason this exists: it is the single
         * place the conversion happens, instead of every caller asserting at its
         * own site. Nothing is unchecked at runtime — MST validates the snapshot
         * as it applies it and throws on a mismatch, which is the check that
         * actually matters for a value this app did not author.
         */
        restoreSession(sessionSnapshot: SessionSnapshot) {
          assertViewTypesLoaded(pluginManager, sessionSnapshot)
          self.session = cast(sessionSnapshot as SnapshotIn<SESSION>)
        },
        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          self.session.setName(sessionName)
        },
        /**
         * #action
         */
        setError(error: unknown) {
          self.error = error
        },
      }))
      .views(self => ({
        /**
         * #getter
         */
        get jbrowse() {
          return self.config
        },
        /**
         * #getter
         */
        get pluginManager() {
          return pluginManager
        },
      })),
    InternetAccountsRootModelMixin(pluginManager),
  )
}
