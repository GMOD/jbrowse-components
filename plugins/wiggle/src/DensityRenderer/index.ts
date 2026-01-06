import { lazy } from 'react'

import DensityRenderer from './DensityRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DensityRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new DensityRenderer({
      name: 'DensityRenderer',
      ReactComponent: lazy(() => import('../WiggleRendering.tsx')),
      configSchema,
      pluginManager,
    })
  })
}
