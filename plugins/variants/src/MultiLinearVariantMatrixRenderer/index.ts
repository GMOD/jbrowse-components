import { lazy } from 'react'

import MultiLinearVariantMatrixRenderer from './MultiLinearVariantMatrixRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantMatrixRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(() => {
    return new MultiLinearVariantMatrixRenderer({
      name: 'LinearVariantMatrixRenderer',
      displayName: 'Linear variant matrix renderer',
      ReactComponent: lazy(
        () => import('./components/MultiLinearVariantMatrixRendering'),
      ),
      configSchema,
      pluginManager,
    })
  })
}
