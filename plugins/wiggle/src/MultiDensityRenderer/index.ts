import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import ReactComponent from '../MultiWiggleRendering'
import MultiDensityRenderer from './MultiDensityRenderer'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiDensityRenderer({
        name: 'MultiDensityRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
