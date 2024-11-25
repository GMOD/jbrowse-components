import ReactComponent from '../MultiWiggleRendering'
import MultiXYPlotRenderer from './MultiXYPlotRenderer'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiXYPlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiXYPlotRenderer({
        name: 'MultiXYPlotRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
