import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, types } from '@jbrowse/mobx-state-tree'
import {
  InternetAccountsRootModelMixin,
  createConfigModel,
  migrateSessionSnapshot,
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

/**
 * A session an embedder hands over may be a v4 one: a share link, a stored
 * snapshot, a `?session=` param a reader still holds. It names display types
 * this build retired and carries settings that are config slots now, which the
 * session type refuses outright — so the whole engine fails to build rather
 * than one track opening at its defaults. ADR-168.
 *
 * An app root runs this once, in `setSession`, because that is its only door.
 * An embedded root has three: the `session` prop at create, and the two actions
 * that assign over it afterwards.
 */
function migrated<T>(snapshot: T, pluginManager: PluginManager): T {
  return snapshot && typeof snapshot === 'object'
    ? (migrateSessionSnapshot(
        snapshot as Record<string, unknown>,
        pluginManager,
      ) as T)
    : snapshot
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
  return types
    .compose(
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
           * Synchronous: an async caller must
           * `await pluginManager.preloadSessionTypes(snapshot)` first.
           */
          setSession(sessionSnapshot: SnapshotIn<SESSION>) {
            pluginManager.assertSessionTypesLoaded(sessionSnapshot)
            self.session = cast(migrated(sessionSnapshot, pluginManager))
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
            pluginManager.assertSessionTypesLoaded(sessionSnapshot)
            self.session = cast(
              migrated(sessionSnapshot, pluginManager) as SnapshotIn<SESSION>,
            )
          },
          /**
           * #action
           */
          renameCurrentSession(sessionName: string) {
            self.session.setName(sessionName)
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
    .preProcessSnapshot(snap =>
      snap && typeof snap === 'object' && 'session' in snap
        ? { ...snap, session: migrated(snap.session, pluginManager) }
        : snap,
    )
}
