import MultiVariantRenderer from './MultiVariantRenderer'
import configSchema from './configSchema'
import ReactComponent from '../shared/components/MultiVariantBaseRendering'

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
