import { lazy } from 'react'

import CanvasFeatureRenderer from './CanvasFeatureRenderer.ts'
import configSchema from './configSchema.ts'
import configSchema2 from './configSchema2.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CanvasFeatureRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new CanvasFeatureRenderer({
      name: 'CanvasFeatureRenderer',
      ReactComponent: lazy(() => import('./CanvasFeatureRendering.tsx')),
      configSchema,
      pluginManager,
    })
  })
  // we fake svgfeaturerenderer, it was removed
  pluginManager.addRendererType(() => {
    return new CanvasFeatureRenderer({
      name: 'SvgFeatureRenderer',
      ReactComponent: lazy(() => import('./CanvasFeatureRendering.tsx')),
      configSchema: configSchema2,
      pluginManager,
    })
  })
}

export { default as configSchema } from './configSchema.ts'
