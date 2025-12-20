import { lazy } from 'react'

import MultiVariantRenderer from './MultiVariantRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiVariantRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new MultiVariantRenderer({
      name: 'MultiVariantRenderer',
      ReactComponent: lazy(
        () => import('./components/MultiLinearVariantRendering'),
      ),
      configSchema,
      pluginManager,
    })
  })
}
