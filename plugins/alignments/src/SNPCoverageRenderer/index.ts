import { lazy } from 'react'

import SNPCoverageRenderer from './SNPCoverageRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new SNPCoverageRenderer({
        name: 'SNPCoverageRenderer',
        ReactComponent: lazy(
          () => import('./components/SNPCoverageRendering.tsx'),
        ),
        configSchema,
        pluginManager,
      }),
  )
}
