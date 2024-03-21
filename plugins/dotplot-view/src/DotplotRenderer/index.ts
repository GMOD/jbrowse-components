import PluginManager from '@jbrowse/core/PluginManager'
import ReactComponent from './components/DotplotRendering'
import DotplotRenderer from './DotplotRenderer'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new DotplotRenderer({
        ReactComponent,
        configSchema: configSchema,
        name: 'DotplotRenderer',
        pluginManager,
      }),
  )
}
