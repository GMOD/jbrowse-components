import { lazy } from 'react'
import MultiRowLineRenderer from './MultiRowLineRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowLineRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiRowLineRenderer({
        name: 'MultiRowLineRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
