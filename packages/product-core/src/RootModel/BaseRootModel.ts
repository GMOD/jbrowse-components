import { filterSessionInPlace } from '@jbrowse/app-core'
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

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { IAnyType, Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

/** Minimal session snapshot shape for type checking */
export interface BaseSessionSnapshot {
  name: string
  id?: string
}

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
       */
      setSession(sessionSnapshot?: SnapshotIn<IAnyType> & BaseSessionSnapshot) {
        const oldSession = self.session
        self.session = cast(sessionSnapshot)
        if (self.session) {
          // validate all references in the session snapshot
          try {
            filterSessionInPlace(self.session, getType(self.session))
          } catch (error) {
            // throws error if session filtering failed
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
