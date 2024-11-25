import DotplotRenderer from './DotplotRenderer'
import ReactComponent from './components/DotplotRendering'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new DotplotRenderer({
        name: 'DotplotRenderer',
        configSchema: configSchema,
        ReactComponent,
        pluginManager,
      }),
  )
}
