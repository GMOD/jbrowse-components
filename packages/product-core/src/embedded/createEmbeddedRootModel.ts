import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, setTypeChecking, types } from '@jbrowse/mobx-state-tree'

import {
  InternetAccountsRootModelMixin,
  createConfigModel,
  prepareSessionSnapshot,
  reportDroppedNodes,
} from '../RootModel/index.ts'
import { migrateSessionSnapshot } from '../sessionMigrations/index.ts'
import { dropUnloadableTracks } from '../sessionUtils.ts'

import type { RootSession } from '../RootModel/index.ts'
import type { SessionSnapshot } from '../sessionUrl.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TrackConfigEntry } from '@jbrowse/core/configuration'
import type { JBrowseConfigModel } from '@jbrowse/core/util'
import type { IAnyModelType, SnapshotIn } from '@jbrowse/mobx-state-tree'

/**
 * A session an embedder hands over may be a v4 one: a share link, a stored
 * snapshot, a `?session=` param a reader still holds. It names display types
 * this build retired and carries settings that are config slots now, which the
 * session type refuses outright — so the whole engine fails to build rather
 * than one track opening at its defaults. ADR-168.
 *
 * `replaceSession` runs it for the two actions that assign a session; this is
 * for the third door, the `session` prop at create.
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
 * the model name, version, and session model, and may `.props()` on extra
 * fields (e.g. the LGV `disableAddTracks`/`drawerViewHeight`). Internet accounts
 * come from the same product-core mixin the web/desktop root models use, so
 * config `internetAccounts` are auto-initialized (no manual wiring needed).
 */
export function createEmbeddedRootModel<
  SESSION extends IAnyModelType & { Type: RootSession },
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
  // as BaseRootModelFactory does: a refused config value names its slot path
  setTypeChecking(true)
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
            this.restoreSession(sessionSnapshot)
          },
          /**
           * #action
           * Load a session whose shape is only known at runtime — decoded from a
           * URL, read back from storage, handed over by a non-TypeScript host.
           * MST validates the snapshot as it applies it and throws on a
           * mismatch, leaving the old session in place.
           */
          restoreSession(sessionSnapshot: SessionSnapshot) {
            const { snapshot, dropped } = prepareSessionSnapshot(
              sessionSnapshot,
              pluginManager,
              sessionModelType,
            )
            // assigned over rather than detached first, as the app root does:
            // this slot is required, so it cannot stand empty in between
            self.session = cast(snapshot as SnapshotIn<SESSION>)
            reportDroppedNodes(self.session, dropped)
          },
          /**
           * #action
           * The `session` prop at create is the third door, after the two
           * above: a track whose config cannot load is dropped there too.
           */
          afterCreate() {
            dropUnloadableTracks(self.session)
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
          get jbrowse(): JBrowseConfigModel {
            const { config } = self
            // the config's snapshot preprocessor expands every loose track, so
            // a stored entry is a TrackConfigEntry; the frozen type stays loose
            // because it is also what an embedder passes in
            return config as Omit<typeof config, 'tracks'> & {
              tracks: TrackConfigEntry[]
            }
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
