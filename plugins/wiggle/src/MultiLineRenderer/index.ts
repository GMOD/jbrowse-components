import { lazy } from 'react'

import MultiLineRenderer from './MultiLineRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiLineRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiLineRenderer({
        name: 'MultiLineRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
