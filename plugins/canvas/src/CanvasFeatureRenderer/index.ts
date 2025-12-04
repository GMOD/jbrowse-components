import { lazy } from 'react'

import CanvasFeatureRenderer from './CanvasFeatureRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CanvasFeatureRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new CanvasFeatureRenderer({
      name: 'CanvasFeatureRenderer',
      ReactComponent: lazy(() => import('./CanvasFeatureRendering')),
      configSchema,
      pluginManager,
    })
  })
}

export { default as configSchema } from './configSchema'
