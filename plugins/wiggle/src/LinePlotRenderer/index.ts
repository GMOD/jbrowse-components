import configSchema from './configSchema'
import LinePlotRenderer from './LinePlotRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'

export default function LinePlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LinePlotRenderer({
        name: 'LinePlotRenderer',
        ReactComponent: lazy(() => import('../WiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
