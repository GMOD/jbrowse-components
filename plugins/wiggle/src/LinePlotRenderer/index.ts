import { lazy } from 'react'

import LinePlotRenderer from './LinePlotRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinePlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LinePlotRenderer({
        name: 'LinePlotRenderer',
        ReactComponent: lazy(() => import('../WiggleRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
