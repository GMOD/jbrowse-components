import PluginManager from '@jbrowse/core/PluginManager'
import assemblyManagerFactory, {
  BaseAssemblyConfigSchema,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import {
  IAnyType,
  Instance,
  SnapshotIn,
  cast,
  getSnapshot,
  isStateTreeNode,
  types,
} from 'mobx-state-tree'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

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
       */
      assemblyManager: types.optional(
        assemblyManagerFactory(assemblyConfigSchema, pluginManager),
        {},
      ),

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
    })
    .volatile(self => ({
      adminMode: false,

      error: undefined as unknown,
      pluginManager,
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          MainThreadRpcDriver: {},
        },
      ),
      textSearchManager: new TextSearchManager(pluginManager),
    }))
    .actions(self => ({
      /**
       * #action
       */
      renameCurrentSession(newName: string) {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          snapshot.name = newName
          this.setSession(snapshot)
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
      setError(error: unknown) {
        self.error = error
      },

      /**
       * #action
       */
      setSession(sessionSnapshot?: SnapshotIn<IAnyType>) {
        self.session = cast(sessionSnapshot)
      },

      /**
       * #action
       */
      setSessionPath(path: string) {
        self.sessionPath = path
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
