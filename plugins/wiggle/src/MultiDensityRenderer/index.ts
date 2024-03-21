import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import ReactComponent from '../MultiWiggleRendering'
import MultiDensityRenderer from './MultiDensityRenderer'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiDensityRenderer({
        ReactComponent,
        configSchema,
        name: 'MultiDensityRenderer',
        pluginManager,
      }),
  )
}
