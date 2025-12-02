import configSchema from './configSchema'
import MultiDensityRenderer from './MultiDensityRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'

export default function MultiDensityRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiDensityRenderer({
        name: 'MultiDensityRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
