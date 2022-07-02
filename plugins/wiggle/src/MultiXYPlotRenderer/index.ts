import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from '../MultiWiggleRendering'
import MultiXYPlotRenderer from './MultiXYPlotRenderer'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
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
