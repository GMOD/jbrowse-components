import PluginManager from '@jbrowse/core/PluginManager'
import ReactComponent from './components/DotplotRendering'
import configSchema from './configSchema'
import DotplotRenderer from './DotplotRenderer'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new DotplotRenderer({
        name: 'DotplotRenderer',
        configSchema: configSchema,
        ReactComponent: ReactComponent,
        pluginManager,
      }),
  )
}
