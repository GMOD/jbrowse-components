import { lazy } from 'react'

import MultiRowXYPlotRenderer from './MultiRowXYPlotRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowXYPlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiRowXYPlotRenderer({
        name: 'MultiRowXYPlotRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
