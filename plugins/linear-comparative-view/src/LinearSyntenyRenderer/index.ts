import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from './components/LinearSyntenyRendering'
import configSchema from './configSchema'
import LinearSyntenyRenderer from './LinearSyntenyRenderer'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new LinearSyntenyRenderer({
        name: 'LinearSyntenyRenderer',
        configSchema,
        ReactComponent,
        pluginManager,
      }),
  )
}
