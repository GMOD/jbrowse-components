import configSchema from './configSchema'

import PluginManager from '@jbrowse/core/PluginManager'
import DensityRenderer from './DensityRenderer'
import ReactComponent from '../WiggleRendering'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new DensityRenderer({
        name: 'DensityRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
