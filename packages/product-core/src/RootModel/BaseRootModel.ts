import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  cast,
  detach,
  getType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'

import {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from '../pruneUnbuildableNodes.ts'
import { scheduleDetachedDestroy } from '../scheduleDetachedDestroy.ts'
import { migrateSessionSnapshot } from '../sessionMigrations/index.ts'
import { filterSessionInPlace } from '../sessionUtils.ts'

import type { BaseSession } from '../Session/BaseSession.ts'
import type { UnbuildableNode } from '../pruneUnbuildableNodes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { RpcManagerOptions } from '@jbrowse/core/rpc/RpcManager'
import type { IAnyType, Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

// `session` is a `types.maybe(sessionModelType)` where `sessionModelType` is the
// erased `IAnyType` (product-core can't name the concrete per-product session
// type without a root↔session cycle), so `self.session` degrades to `any`. Every
// concrete session composes BaseSessionModel + SnackbarModel, so asserting the
// shared `BaseSession` contract restores real checking on the `setName`/`notify`
// members the base root reaches for — without a hand-maintained shadow.

/**
 * #stateModel BaseRootModel
 * #category root
 * factory function for the Base-level root model shared by all products
 */
export function BaseRootModelFactory({
  pluginManager,
  jbrowseModelType,
  sessionModelType,
  assemblyConfigSchema,
  rpcManagerOptions,
}: {
  pluginManager: PluginManager
  jbrowseModelType: IAnyType
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
            migrateSessionSnapshot(sessionSnapshot as Record<string, unknown>),
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
            const dropped = filterSessionInPlace(
              self.session,
              getType(self.session),
            )
            if (dropped.length > 0) {
              const names = dropped
                .map(d => d.configuration ?? d.type ?? 'unknown')
                .join(', ')
              const plural = dropped.length > 1
              ;(self.session as BaseSession).notify(
                `Removed ${dropped.length} track${plural ? 's' : ''} that could not be loaded: ${names}`,
                'warning',
              )
            }
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
       */
      setDefaultSession() {
        const { defaultSession } = self.jbrowse
        this.setSession({
          ...defaultSession,
          // timestamp the name so repeated "new session" names don't collide
          name: `${defaultSession.name || 'New session'} ${new Date().toLocaleString()}`,
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
