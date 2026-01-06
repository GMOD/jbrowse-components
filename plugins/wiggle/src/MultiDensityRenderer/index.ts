import { lazy } from 'react'

import MultiDensityRenderer from './MultiDensityRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiDensityRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiDensityRenderer({
        name: 'MultiDensityRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
