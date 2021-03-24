import ConnectionType from '@jbrowse/core/pluggableElementTypes/ConnectionType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { SessionWithWidgets, isAbstractMenuManager } from '@jbrowse/core/util'
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
import AssemblyManager from './AssemblyManager'
import SetDefaultSession from './SetDefaultSession'

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
        ReactComponent: HierarchicalTrackSelectorReactComponent,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AddTrackWidget',
        heading: 'Add a track',
        configSchema: AddTrackConfigSchema,
        stateModel: AddTrackStateModelFactory(pluginManager),
        ReactComponent: AddTrackReactComponent,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AddConnectionWidget',
        heading: 'Add a connection',
        configSchema: AddConnectionConfigSchema,
        stateModel: AddConnectionStateModel,
        ReactComponent: AddConnectionReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('File', {
        label: 'Open track',
        icon: NoteAddIcon,
        onClick: (session: SessionWithWidgets) => {
          if (session.views.length === 0) {
            session.notify('Please open a view to add a track first')
          } else if (session.views.length >= 1) {
            const widget = session.addWidget(
              'AddTrackWidget',
              'addTrackWidget',
              { view: session.views[0].id },
            )
            session.showWidget(widget)
            if (session.views.length > 1) {
              session.notify(
                `This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right`,
              )
            }
          }
        },
      })
      pluginManager.rootModel.appendToMenu('File', {
        label: 'Open connection',
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
