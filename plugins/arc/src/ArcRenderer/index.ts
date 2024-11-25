import ArcRenderer from './ArcRenderer'
import ReactComponent from './ArcRendering'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function ArcRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new ArcRenderer({
        name: 'ArcRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
