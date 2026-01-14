import { lazy } from 'react'

import MultiRowLineRenderer from './MultiRowLineRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowLineRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiRowLineRenderer({
        name: 'MultiRowLineRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
