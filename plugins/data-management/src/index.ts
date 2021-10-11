import { lazy } from 'react'
import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchema as ucscConfigSchema,
  modelFactory as ucscModelFactory,
} from './ucsc-trackhub'
import {
  stateModelFactory as AddTrackStateModelFactory,
  configSchema as AddTrackConfigSchema,
} from './AddTrackWidget'
import {
  stateModel as AddConnectionStateModel,
  configSchema as AddConnectionConfigSchema,
} from './AddConnectionWidget'
import {
  stateModelFactory as HierarchicalTrackSelectorStateModelFactory,
  configSchema as HierarchicalTrackSelectorConfigSchema,
} from './HierarchicalTrackSelectorWidget'
import {
  stateModelFactory as PluginStoreStateModelFactory,
  configSchema as PluginStoreConfigSchema,
} from './PluginStoreWidget'

const SetDefaultSession = lazy(() => import('./SetDefaultSession'))

const AssemblyManager = lazy(() => import('./AssemblyManager'))

export default class extends Plugin {
  name = 'DataManagementPlugin'

  exports = {
    AssemblyManager,
    SetDefaultSession,
  }

  install(pluginManager: PluginManager) {
    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'UCSCTrackHubConnection',
          configSchema: ucscConfigSchema,
          stateModel: ucscModelFactory(pluginManager),
          displayName: 'UCSC Track Hub',
          description: 'A track or assembly hub in the Track Hub format',
          url: '//genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro',
        }),
    )

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'HierarchicalTrackSelectorWidget',
        heading: 'Available tracks',
        configSchema: HierarchicalTrackSelectorConfigSchema,
        stateModel: HierarchicalTrackSelectorStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () =>
            import(
              './HierarchicalTrackSelectorWidget/components/HierarchicalTrackSelector'
            ),
        ),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AddTrackWidget',
        heading: 'Add a track',
        configSchema: AddTrackConfigSchema,
        stateModel: AddTrackStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./AddTrackWidget/components/AddTrackWidget'),
        ),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AddConnectionWidget',
        heading: 'Add a connection',
        configSchema: AddConnectionConfigSchema,
        stateModel: AddConnectionStateModel,
        ReactComponent: lazy(
          () => import('./AddConnectionWidget/components/AddConnectionWidget'),
        ),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'PluginStoreWidget',
        heading: 'Plugin store',
        configSchema: PluginStoreConfigSchema,
        stateModel: PluginStoreStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./PluginStoreWidget/components/PluginStoreWidget'),
        ),
      })
    })
  }

  configure(pluginManager: PluginManager) {}
}

export { AssemblyManager, SetDefaultSession }
