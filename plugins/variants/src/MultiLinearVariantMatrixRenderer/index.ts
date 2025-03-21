import LinearVariantMatrixRenderer from './LinearVariantMatrixRenderer'
import PrerenderedCanvas from './components/LinearVariantMatrixRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantMatrixRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(() => {
    return new LinearVariantMatrixRenderer({
      name: 'LinearVariantMatrixRenderer',
      displayName: 'Linear variant matrix renderer',
      ReactComponent: PrerenderedCanvas,
      configSchema,
      pluginManager,
    })
  })
}
