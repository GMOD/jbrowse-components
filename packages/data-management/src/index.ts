import { lazy } from 'react'
import ConnectionType from '@gmod/jbrowse-core/pluggableElementTypes/ConnectionType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  SessionWithDrawerWidgets,
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
} from './AddTrackDrawerWidget'
import {
  ReactComponent as AddConnectionReactComponent,
  stateModel as AddConnectionStateModel,
  configSchema as AddConnectionConfigSchema,
} from './AddConnectionDrawerWidget'
import {
  ReactComponent as HierarchicalTrackSelectorReactComponent,
  stateModelFactory as HierarchicalTrackSelectorStateModelFactory,
  configSchema as HierarchicalTrackSelectorConfigSchema,
} from './HierarchicalTrackSelectorDrawerWidget'

export default class extends Plugin {
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

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      if (pluginManager.rootModel.adminMode) {
        pluginManager.rootModel.appendToMenu('File', {
          label: 'Open new track',
          icon: NoteAddIcon,
          onClick: (session: SessionWithDrawerWidgets) => {
            const drawerWidget = session.addDrawerWidget(
              'AddTrackDrawerWidget',
              'addTrackDrawerWidget',
            )
            session.showDrawerWidget(drawerWidget)
          },
        })
        pluginManager.rootModel.appendToMenu('File', {
          label: 'Open new connection',
          icon: InputIcon,
          onClick: (session: SessionWithDrawerWidgets) => {
            const drawerWidget = session.addDrawerWidget(
              'AddConnectionDrawerWidget',
              'addConnectionDrawerWidget',
            )
            session.showDrawerWidget(drawerWidget)
          },
        })
      }
    }
  }
}
