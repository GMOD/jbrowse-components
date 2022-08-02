import PluginManager from '@jbrowse/core/PluginManager'
import ReactComponent from '../MultiWiggleRendering'
import MultiRowXYPlotRenderer from './MultiRowXYPlotRenderer'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiRowXYPlotRenderer({
        name: 'MultiRowXYPlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
