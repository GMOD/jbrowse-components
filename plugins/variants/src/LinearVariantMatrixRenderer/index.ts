import PluginManager from '@jbrowse/core/PluginManager'
import LinearVariantMatrixRenderer from './LinearVariantMatrixRenderer'
import ReactComponent from './components/LinearVariantMatrixRendering'
import configSchema from './configSchema'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new LinearVariantMatrixRenderer({
      name: 'LinearVariantMatrixRenderer',
      displayName: 'Linear variant matrix renderer',
      ReactComponent,
      configSchema,
      pluginManager,
    })
  })
}
