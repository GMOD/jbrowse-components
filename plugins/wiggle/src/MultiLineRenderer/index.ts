import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from '../MultiWiggleRendering'
import MultiLineRenderer from './MultiLineRenderer'
import configSchema from './configSchema'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new MultiLineRenderer({
        name: 'MultiLineRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
