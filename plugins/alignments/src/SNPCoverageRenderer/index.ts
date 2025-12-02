import { lazy } from 'react'
import SNPCoverageRenderer from './SNPCoverageRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new SNPCoverageRenderer({
        name: 'SNPCoverageRenderer',
        ReactComponent: lazy(() => import('./WiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
