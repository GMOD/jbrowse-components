import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { scheduleDetachedDestroy } from '@jbrowse/core/util'
import {
  cast,
  detach,
  isStateTreeNode,
  setTypeChecking,
  types,
} from '@jbrowse/mobx-state-tree'

import {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from '../pruneUnbuildableNodes.ts'
import { migrateSessionSnapshot } from '../sessionMigrations/index.ts'
import { dropUnloadableTracks } from '../sessionUtils.ts'

import type { BaseSession } from '../Session/BaseSession.ts'
import type { UnbuildableNode } from '../pruneUnbuildableNodes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { RpcManagerOptions } from '@jbrowse/core/rpc/RpcManager'
import type { EditableJBrowseConfigModel } from '@jbrowse/core/util'
import type {
  IAnyType,
  IType,
  Instance,
  SnapshotIn,
} from '@jbrowse/mobx-state-tree'

// `session` is a `types.maybe(sessionModelType)` where `sessionModelType` is the
// erased `IAnyType` (product-core can't name the concrete per-product session
// type without a root↔session cycle), so `self.session` degrades to `any`. Every
// concrete session composes BaseSessionModel + SnackbarModel, so asserting the
// shared `BaseSession` contract restores real checking on the `setName`/`notify`
// members the base root reaches for — without a hand-maintained shadow.

/**
 * #stateModel BaseRootModel
 * #category root
 * Holds the loaded config, the session, the assembly manager and the RPC
 * manager. Every JBrowse product's root model composes this one.
 */
export function BaseRootModelFactory({
  pluginManager,
  jbrowseModelType,
  sessionModelType,
  assemblyConfigSchema,
  rpcManagerOptions,
}: {
  pluginManager: PluginManager
  jbrowseModelType: IType<any, any, EditableJBrowseConfigModel>
  sessionModelType: IAnyType
  assemblyConfigSchema: BaseAssemblyConfigSchema
  /**
   * How this product drives RPC — its worker factory and default driver. Taken
   * here rather than left to each product to redefine the `rpcManager`
   * volatile: a redefinition shadows this one but does not stop it being
   * constructed, so every root built two managers and threw one away.
   */
  rpcManagerOptions?: RpcManagerOptions
}) {
  // A config value its slot refuses then fails with the slot path named, in
  // every product: unchecked, a union of display types reported only "No
  // matching type for union", and a track-level scalar went in unchecked
  setTypeChecking(true)
  return types
    .model('BaseRootModel', {
      /**
       * #property
       * `jbrowse` is a mapping of the config.json into the in-memory state
       * tree
       */
      jbrowse: jbrowseModelType,

      /**
       * #property
       * `session` encompasses the currently active state of the app, including
       * views open, tracks open in those views, etc.
       */
      session: types.maybe(sessionModelType),
      /**
       * #property
       */
      sessionPath: types.stripDefault(types.string, ''),

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
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        rpcManagerOptions,
      ),

      /**
       * #volatile
       */
      adminMode: false,
      /**
       * #volatile
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,
      /**
       * #volatile
       */
      textSearchManager: new TextSearchManager(pluginManager),
      /**
       * #volatile
       */
      pluginManager,
      /**
       * #volatile
       * What has to stop the moment the host lets go of this root: everything
       * reaching outside the tree, like an autosave autorun.
       *
       * Not `addDisposer`, which fires only on destroy, and destroy follows a
       * task later, once React has let go of the views it still holds (ADR-069).
       * Work left running in that gap acts for the outgoing session. See
       * `detach`.
       */
      detachDisposers: [] as (() => void)[],
    }))
    .actions(self => ({
      /**
       * #action
       */
      setError(error: unknown) {
        self.error = error
      },
      /**
       * #action
       * Register something that must stop when the host detaches this root.
       */
      addDetachDisposer(disposer: () => void) {
        self.detachDisposers.push(disposer)
      },
      /**
       * #action
       * Called when the host releases this root. Stops the worker pool and
       * whatever was registered with `addDetachDisposer`, and leaves the tree
       * itself alone.
       *
       * The caller destroys the tree on a later task
       * (`scheduleDetachedDestroy`), which runs the `beforeDestroy` hooks in
       * it; plugins rely on those hooks, so the destroy cannot be skipped.
       * ADR-069.
       */
      detach() {
        // rpcManager is a plain object on a volatile, so MST teardown never
        // reaches it
        self.rpcManager.destroy()
        const disposers = self.detachDisposers
        self.detachDisposers = []
        for (const disposer of disposers) {
          disposer()
        }
      },
      /**
       * #action
       * Sets the active session. Remaps any legacy display type names
       * (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), drops nodes whose
       * pluggable type this build has no plugin for (see
       * `pruneUnbuildableNodes`), then walks the resulting MST tree to drop open
       * tracks whose config can't hydrate so shared sessions still load when
       * referencing tracks that no longer exist. Both kinds of drop are surfaced
       * to the user via a snackbar. If filtering throws, the previous session is
       * restored.
       */
      setSession(sessionSnapshot?: SnapshotIn<IAnyType>) {
        const oldSession = self.session
        const unbuildable: UnbuildableNode[] = []
        let migrated = sessionSnapshot
        if (sessionSnapshot && typeof sessionSnapshot === 'object') {
          pluginManager.assertSessionTypesLoaded(sessionSnapshot)
          // before the cast, because a type this build has no plugin for is a
          // union failure the try below never gets to see
          const pruned = pruneUnbuildableNodes(
            migrateSessionSnapshot(
              sessionSnapshot as Record<string, unknown>,
              pluginManager,
            ),
            pluginManager,
            sessionModelType,
          )
          migrated = pruned.snapshot
          unbuildable.push(...pruned.dropped)
        }
        // Detach first: assigning over it would destroy it inside this action,
        // and MobX runs the action's pending reactions afterwards, against the
        // nodes it just killed. ADR-069.
        if (oldSession) {
          detach(oldSession)
        }
        // The assignment is inside the try because it typechecks: a registered
        // type carrying a malformed prop is a throw `pruneUnbuildableNodes`
        // does not and cannot pre-empt, and the detach above has already
        // emptied `self.session`. MST does not roll an action back, so without
        // this the root would be left with no session at all and the old tree
        // detached-and-alive forever.
        try {
          self.session = cast(migrated)
          if (self.session) {
            const unbuildableMessage = describeUnbuildableNodes(unbuildable)
            if (unbuildableMessage) {
              ;(self.session as BaseSession).notify(
                unbuildableMessage,
                'warning',
              )
            }
            dropUnloadableTracks(self.session as BaseSession)
          }
        } catch (error) {
          // put it back, and do not schedule the destroy below — this is the
          // one path where the old session goes on being the live one
          self.session = oldSession
          throw error
        }
        // and it does still get destroyed, once the reaction flush has
        // unwound. `beforeDestroy` is a plugin-facing contract and leaving a
        // detached session alive forever would skip it. ADR-069.
        if (oldSession) {
          scheduleDetachedDestroy(oldSession)
        }
      },
      /**
       * #action
       * Starts a new session from the config's defaultSession. An `id` in it
       * (a pasted session export has one) is dropped, since sessions are
       * autosaved by id and each new one would otherwise overwrite the last.
       * The name has no date, because the saved-session lists show when each was
       * used, and a dated name saved back as the default would gain another
       * date on every new session.
       */
      setDefaultSession() {
        const { id: _id, ...defaultSession } = self.jbrowse.defaultSession
        this.setSession({
          ...defaultSession,
          name: defaultSession.name || 'New session',
        })
      },
      /**
       * #action
       */
      setSessionPath(path: string) {
        self.sessionPath = path
      },
      /**
       * #action
       */
      renameCurrentSession(newName: string) {
        // Every concrete session model is composed from BaseSessionModel, which
        // provides setName — avoid a full setSession rebuild here since the
        // only field changing is `name`.
        ;(self.session as BaseSession | undefined)?.setName(newName)
      },
    }))
}

export type BaseRootModelType = ReturnType<typeof BaseRootModelFactory>
export type BaseRootModel = Instance<BaseRootModelType>

/** Type guard for checking if something is a JB root model */
export function isRootModel(thing: unknown): thing is BaseRootModel {
  return (
    isStateTreeNode(thing) &&
    'session' in thing &&
    'jbrowse' in thing &&
    'assemblyManager' in thing
  )
}
