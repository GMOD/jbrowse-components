import ReactComponent from '../WiggleRendering'
import PluginManager from '@jbrowse/core/PluginManager'
import XYPlotRenderer from './XYPlotRenderer'
import configSchema from './configSchema'
export { XYPlotRenderer, configSchema, ReactComponent }

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new XYPlotRenderer({
        name: 'XYPlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
