import PluginManager from '@jbrowse/core/PluginManager'
import assemblyManagerFactory, {
  BaseAssemblyConfigSchema,
} from '@jbrowse/core/assemblyManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { IAnyType, SnapshotIn, cast, getSnapshot, types } from 'mobx-state-tree'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

/**
 * factory function for the Base-level root model shared by all products
 */
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
      version: 'development',

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
      setSession(sessionSnapshot?: SnapshotIn<SESSION_MODEL_TYPE>) {
        self.session = cast(sessionSnapshot)
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
      async renameCurrentSession(newName: string) {
        if (self.session) {
          this.setSession({ ...getSnapshot(self.session), name: newName })
        }
      },
      /**
       * #action
       */
      setOpenNewSessionCallback(cb: (arg: string) => Promise<void>) {
        self.openNewSessionCallback = cb
      },
      /**
       * #action
       */
      setAssemblyEditing(flag: boolean) {
        self.isAssemblyEditing = flag
      },
    }))
}
