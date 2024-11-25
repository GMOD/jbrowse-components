import ReactComponent from '../WiggleRendering'
import XYPlotRenderer from './XYPlotRenderer'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function XYPlotRendererF(pluginManager: PluginManager) {
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
