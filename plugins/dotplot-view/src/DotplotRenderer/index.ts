import { lazy } from 'react'

import DotplotRenderer from './DotplotRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new DotplotRenderer({
        name: 'DotplotRenderer',
        configSchema: configSchema,
        ReactComponent: lazy(() => import('./components/DotplotRendering.tsx')),
        pluginManager,
      }),
  )
}
