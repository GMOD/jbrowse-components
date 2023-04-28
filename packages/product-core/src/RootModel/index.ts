import PluginManager from '@jbrowse/core/PluginManager'
import assemblyManagerFactory, {
  BaseAssemblyConfigSchema,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { IAnyType, Instance, types } from 'mobx-state-tree'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

export function BaseRootModel<
  JBROWSE_MODEL_TYPE extends IAnyType,
  SESSION_MODEL_TYPE extends IAnyType,
>(
  pluginManager: PluginManager,
  jbrowseModelType: JBROWSE_MODEL_TYPE,
  sessionModelType: SESSION_MODEL_TYPE,
  assemblyConfigSchema: BaseAssemblyConfigSchema,
) {
  return types
    .model('BaseRootModel', {
      /**
       * #property
       * `jbrowse` is a mapping of the config.json into the in-memory state tree
       */
      jbrowse: jbrowseModelType,
      /**
       * #property
       */
      version: types.string,

      /**
       * #property
       * `session` encompasses the currently active state of the app, including
       * views open, tracks open in those views, etc.
       */
      session: types.maybe(sessionModelType),
      /**
       * #property
       */
      assemblyManager: assemblyManagerFactory(
        assemblyConfigSchema,
        pluginManager,
      ),
    })
    .volatile(self => ({
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          MainThreadRpcDriver: {},
        },
      ),

      /**
       * #volatile
       * Boolean indicating whether the session is in admin mode or not
       */
      adminMode: true,

      isAssemblyEditing: false,
      error: undefined as unknown,
      textSearchManager: new TextSearchManager(pluginManager),
      openNewSessionCallback: async (_path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
      pluginManager,
    }))
}

export type RootModel = Instance<ReturnType<typeof BaseRootModel>>
