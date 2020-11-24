import assemblyManagerFactory, {
  assemblyConfigSchemas as createAssemblyConfigSchemas,
} from '@jbrowse/core/assemblyManager'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { cast, getSnapshot, SnapshotIn, types } from 'mobx-state-tree'
import corePlugins from '../corePlugins'
import createConfigModel from './createConfigModel'
import createSessionModel from './createSessionModel'

export default function createModel(runtimePlugins: PluginConstructor[]) {
  const pluginManager = new PluginManager(
    [...corePlugins, ...runtimePlugins].map(P => new P()),
  )
  pluginManager.createPluggableElements()
  const Session = createSessionModel(pluginManager)
  const { assemblyConfigSchemas, dispatcher } = createAssemblyConfigSchemas(
    pluginManager,
  )
  const assemblyConfigSchemasType = types.union(
    { dispatcher },
    ...assemblyConfigSchemas,
  )
  const assemblyManagerType = assemblyManagerFactory(
    assemblyConfigSchemasType,
    pluginManager,
  )
  const rootModel = types
    .model('ReactLinearGenomeView', {
      config: createConfigModel(pluginManager, assemblyConfigSchemasType),
      session: Session,
      assemblyManager: assemblyManagerType,
      error: types.maybe(types.string),
    })
    .actions(self => ({
      setSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
      },
      renameCurrentSession(sessionName: string) {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          snapshot.name = sessionName
          this.setSession(snapshot)
        }
      },
      setError(errorMessage: string | Error) {
        self.error = String(errorMessage)
      },
    }))
    .views(self => ({
      get jbrowse() {
        return self.config
      },
    }))
    .volatile(self => ({
      rpcManager: new RpcManager(
        pluginManager,
        // don't need runtimePluginDefinitions since MainThreadRpcDriver doesn't
        // use them
        [],
        self.config.configuration.rpc,
        { MainThreadRpcDriver: {} },
      ),
    }))
  return { model: rootModel, pluginManager }
}
