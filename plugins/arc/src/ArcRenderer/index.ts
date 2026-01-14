import { lazy } from 'react'

import ArcRenderer from './ArcRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ArcRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new ArcRenderer({
        name: 'ArcRenderer',
        ReactComponent: lazy(() => import('./ArcRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
