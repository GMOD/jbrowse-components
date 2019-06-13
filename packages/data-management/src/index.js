import { lazy } from 'react'
import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  configSchema as ucscConfigSchema,
  modelFactory as ucscModelFactory,
} from './ucsc-trackhub'
import {
  configSchema as jbrowse1ConfigSchema,
  modelFactory as jbrowse1ModelFactory,
} from './jbrowse1'
import {
  reactComponent as AddTrackReactComponent,
  stateModelFactory as AddTrackStateModelFactory,
  configSchema as AddTrackConfigSchema,
} from './AddTrackDrawerWidget'
import {
  reactComponent as AddConnectionReactComponent,
  stateModel as AddConnectionStateModel,
  configSchema as AddConnectionConfigSchema,
} from './AddConnectionDrawerWidget'
import {
  reactComponent as HierarchicalTrackSelectorReactComponent,
  stateModelFactory as HierarchicalTrackSelectorStateModelFactory,
  configSchema as HierarchicalTrackSelectorConfigSchema,
} from './HierarchicalTrackSelectorDrawerWidget'

export default class extends Plugin {
  install(pluginManager) {
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

    pluginManager.addConnectionType(
      () =>
        new ConnectionType({
          name: 'JBrowse1Connection',
          configSchema: jbrowse1ConfigSchema,
          stateModel: jbrowse1ModelFactory(pluginManager),
          displayName: 'JBrowse 1 Data',
          description: 'A JBrowse 1 data directory',
          url: '//jbrowse.org/',
        }),
    )

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'HierarchicalTrackSelectorDrawerWidget',
        heading: 'Available Tracks',
        configSchema: HierarchicalTrackSelectorConfigSchema,
        stateModel: HierarchicalTrackSelectorStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => HierarchicalTrackSelectorReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'AddTrackDrawerWidget',
        heading: 'Add a track',
        configSchema: AddTrackConfigSchema,
        stateModel: AddTrackStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => AddTrackReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'AddConnectionDrawerWidget',
        heading: 'Add a connection',
        configSchema: AddConnectionConfigSchema,
        stateModel: AddConnectionStateModel,
        LazyReactComponent: lazy(() => AddConnectionReactComponent),
      })
    })
  }
}
