import { lazy } from 'react'

import MultiLinearVariantMatrixRenderer from './MultiLinearVariantMatrixRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantMatrixRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(() => {
    return new MultiLinearVariantMatrixRenderer({
      name: 'LinearVariantMatrixRenderer',
      displayName: 'Linear variant matrix renderer',
      ReactComponent: lazy(
        () => import('./components/MultiLinearVariantMatrixRendering.tsx'),
      ),
      configSchema,
      pluginManager,
    })
  })
}
