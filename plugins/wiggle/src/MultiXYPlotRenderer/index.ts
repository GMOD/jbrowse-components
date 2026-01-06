import { lazy } from 'react'

import MultiXYPlotRenderer from './MultiXYPlotRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiXYPlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiXYPlotRenderer({
        name: 'MultiXYPlotRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
