import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  cast,
  getSnapshot,
  getType,
  isStateTreeNode,
  types,
} from '@jbrowse/mobx-state-tree'

import { migrateSessionSnapshot } from '../sessionMigrations/index.ts'
import { filterSessionInPlace } from '../sessionUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { IAnyType, Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

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
}: {
  pluginManager: PluginManager
  jbrowseModelType: IAnyType
  sessionModelType: IAnyType
  assemblyConfigSchema: BaseAssemblyConfigSchema
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
      sessionPath: types.optional(types.string, ''),

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
        {
          MainThreadRpcDriver: {},
        },
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
       * (e.g. LinearPileupDisplay → LinearAlignmentsDisplay), then walks the
       * resulting MST tree to drop undefined references in arrays/maps so
       * shared sessions still load when referencing tracks/widgets that no
       * longer exist. If filtering throws, the previous session is restored.
       */
      setSession(sessionSnapshot?: SnapshotIn<IAnyType>) {
        const oldSession = self.session
        const migrated =
          sessionSnapshot && typeof sessionSnapshot === 'object'
            ? migrateSessionSnapshot(
                sessionSnapshot as Record<string, unknown>,
              )
            : sessionSnapshot
        self.session = cast(migrated)
        if (self.session) {
          try {
            filterSessionInPlace(self.session, getType(self.session))
          } catch (error) {
            self.session = oldSession
            throw error
          }
        }
      },
      /**
       * #action
       */
      setDefaultSession() {
        this.setSession(self.jbrowse.defaultSession)
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
        if (self.session) {
          this.setSession({
            ...getSnapshot(self.session),
            name: newName,
          })
        }
      },
    }))
}

export type BaseRootModelType = ReturnType<typeof BaseRootModelFactory>
export type BaseRootModel = Instance<BaseRootModelType>

/** Type guard for checking if something is a JB root model */
export function isRootModel(thing: unknown): thing is BaseRootModelType {
  return (
    isStateTreeNode(thing) &&
    'session' in thing &&
    'jbrowse' in thing &&
    'assemblyManager' in thing
  )
}
