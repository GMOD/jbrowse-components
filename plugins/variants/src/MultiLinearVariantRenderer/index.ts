import MultiVariantRenderer from './MultiVariantRenderer'
import ReactComponent from './components/MultiLinearVariantRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

// locals

export default function MultiVariantRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new MultiVariantRenderer({
      name: 'MultiVariantRenderer',
      ReactComponent,
      configSchema,
      pluginManager,
    })
  })
}
