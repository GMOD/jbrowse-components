import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  SessionWithWidgets,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import FileCopyIcon from '@material-ui/icons/FileCopy'
import FolderOpenIcon from '@material-ui/icons/FolderOpen'
import HelpIcon from '@material-ui/icons/Help'
import InfoIcon from '@material-ui/icons/Info'
import SaveIcon from '@material-ui/icons/Save'
import {
  configSchema as aboutConfigSchema,
  ReactComponent as AboutReactComponent,
  stateModel as aboutStateModel,
} from './AboutWidget'
import {
  configSchema as helpConfigSchema,
  ReactComponent as HelpReactComponent,
  stateModel as helpStateModel,
} from './HelpWidget'
import {
  configSchema as importConfigurationConfigSchema,
  ReactComponent as ImportConfigurationReactComponent,
  stateModel as importConfigurationStateModel,
} from './ImportConfigurationWidget'
import {
  configSchema as sessionManagerConfigSchema,
  ReactComponent as SessionManagerReactComponent,
  stateModel as sessionManagerStateModel,
} from './SessionManager'

export default class extends Plugin {
  name = 'MenusPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'AboutWidget',
        heading: 'About',
        configSchema: aboutConfigSchema,
        stateModel: aboutStateModel,
        ReactComponent: AboutReactComponent,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'HelpWidget',
        heading: 'Help',
        configSchema: helpConfigSchema,
        stateModel: helpStateModel,
        ReactComponent: HelpReactComponent,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ImportConfigurationWidget',
        heading: 'Import Configuration',
        configSchema: importConfigurationConfigSchema,
        stateModel: importConfigurationStateModel,
        ReactComponent: ImportConfigurationReactComponent,
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'SessionManager',
        heading: 'Sessions',
        configSchema: sessionManagerConfigSchema,
        stateModel: sessionManagerStateModel,
        ReactComponent: SessionManagerReactComponent,
      })
    })
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'About',
        icon: InfoIcon,
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('AboutWidget', 'aboutWidget')
          session.showWidget(widget)
        },
      })
      pluginManager.rootModel.appendToMenu('Help', {
        label: 'Help',
        icon: HelpIcon,
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('HelpWidget', 'helpWidget')
          session.showWidget(widget)
        },
      })
      pluginManager.rootModel.insertInMenu(
        'File',
        {
          label: 'Open session…',
          icon: FolderOpenIcon,
          onClick: (session: SessionWithWidgets) => {
            const widget = session.addWidget('SessionManager', 'sessionManager')
            session.showWidget(widget)
          },
        },
        1,
      )
      pluginManager.rootModel.insertInMenu(
        'File',
        {
          label: 'Save session',
          icon: SaveIcon,
          onClick: (session: SessionWithWidgets) => {
            // @ts-ignore
            if (session.saveSessionToLocalStorage) {
              // @ts-ignore
              session.saveSessionToLocalStorage()
              // @ts-ignore
              session.notify(`Saved session "${session.name}"`, 'success')
            }
          },
        },
        1,
      )
      pluginManager.rootModel.insertInMenu(
        'File',
        {
          label: 'Duplicate session',
          icon: FileCopyIcon,
          onClick: (session: AbstractSessionModel) => {
            session.duplicateCurrentSession?.()
          },
        },
        1,
      )
    }
  }
}
