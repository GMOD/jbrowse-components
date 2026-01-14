import { lazy } from 'react'

import MultiRowXYPlotRenderer from './MultiRowXYPlotRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowXYPlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiRowXYPlotRenderer({
        name: 'MultiRowXYPlotRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
