import { lazy } from 'react'

import LinePlotRenderer from './LinePlotRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

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
