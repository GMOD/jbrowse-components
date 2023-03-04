import ReactComponent from '../WiggleRendering'
import PluginManager from '@jbrowse/core/PluginManager'
import XYPlotRenderer from './XYPlotRenderer'
import configSchema from './configSchema'

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

export { default as XYPlotRenderer } from './XYPlotRenderer'
export { default as ReactComponent } from '../WiggleRendering'
export { default as configSchema } from './configSchema'
