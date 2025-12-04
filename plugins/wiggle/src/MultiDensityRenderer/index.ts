import { lazy } from 'react'

import MultiDensityRenderer from './MultiDensityRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

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
