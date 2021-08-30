import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { cast, getSnapshot, types, Instance, SnapshotIn } from 'mobx-state-tree'
import corePlugins from '../corePlugins'
import createConfigModel from './createConfigModel'
import createSessionModel from './createSessionModel'

export default function createModel(runtimePlugins: PluginConstructor[]) {
  const pluginManager = new PluginManager(
    [...corePlugins, ...runtimePlugins].map(P => new P()),
  )
  pluginManager.createPluggableElements()
  const Session = createSessionModel(pluginManager)
  const assemblyConfig = assemblyConfigSchemaFactory(pluginManager)
  const assemblyManagerType = assemblyManagerFactory(
    assemblyConfig,
    pluginManager,
  )
  const rootModel = types
    .model('ReactLinearGenomeView', {
      config: createConfigModel(pluginManager, assemblyConfig),
      session: Session,
      assemblyManager: assemblyManagerType,
    })
    .volatile(() => ({
      error: undefined as Error | undefined,
    }))
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
      setError(errorMessage: Error | undefined) {
        self.error = errorMessage
      },
    }))
    .views(self => ({
      get jbrowse() {
        return self.config
      },
    }))
    .volatile(self => ({
      rpcManager: new RpcManager(pluginManager, self.config.configuration.rpc, {
        MainThreadRpcDriver: {},
      }),
      textSearchManager: new TextSearchManager(pluginManager),
    }))
  return { model: rootModel, pluginManager }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
