import { lazy } from 'react'
import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  SessionWithWidgets,
  isAbstractMenuManager,
} from '@gmod/jbrowse-core/util'
import NoteAddIcon from '@material-ui/icons/NoteAdd'
import InputIcon from '@material-ui/icons/Input'
import {
  configSchema as ucscConfigSchema,
  modelFactory as ucscModelFactory,
} from './ucsc-trackhub'
import {
  ReactComponent as AddTrackReactComponent,
  stateModelFactory as AddTrackStateModelFactory,
  configSchema as AddTrackConfigSchema,
} from './AddTrackWidget'
import {
  ReactComponent as AddConnectionReactComponent,
  stateModel as AddConnectionStateModel,
  configSchema as AddConnectionConfigSchema,
} from './AddConnectionWidget'
import {
  ReactComponent as HierarchicalTrackSelectorReactComponent,
  stateModelFactory as HierarchicalTrackSelectorStateModelFactory,
  configSchema as HierarchicalTrackSelectorConfigSchema,
} from './HierarchicalTrackSelectorWidget'

export default class extends Plugin {
  name = 'DataManagementPlugin'

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
        heading: 'Available Tracks',
        configSchema: HierarchicalTrackSelectorConfigSchema,
        stateModel: HierarchicalTrackSelectorStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => HierarchicalTrackSelectorReactComponent),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AddTrackWidget',
        heading: 'Add a track',
        configSchema: AddTrackConfigSchema,
        stateModel: AddTrackStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => AddTrackReactComponent),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AddConnectionWidget',
        heading: 'Add a connection',
        configSchema: AddConnectionConfigSchema,
        stateModel: AddConnectionStateModel,
        LazyReactComponent: lazy(() => AddConnectionReactComponent),
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      if (pluginManager.rootModel.adminMode) {
        pluginManager.rootModel.appendToMenu('File', {
          label: 'Open new track',
          icon: NoteAddIcon,
          onClick: (session: SessionWithWidgets) => {
            const widget = session.addWidget('AddTrackWidget', 'addTrackWidget')
            session.showWidget(widget)
          },
        })
        pluginManager.rootModel.appendToMenu('File', {
          label: 'Open new connection',
          icon: InputIcon,
          onClick: (session: SessionWithWidgets) => {
            const widget = session.addWidget(
              'AddConnectionWidget',
              'addConnectionWidget',
            )
            session.showWidget(widget)
          },
        })
      }
    }
  }
}
