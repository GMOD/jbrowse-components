import { lazy } from 'react'

import ArcRenderer from './ArcRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ArcRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new ArcRenderer({
        name: 'ArcRenderer',
        ReactComponent: lazy(() => import('./ArcRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
