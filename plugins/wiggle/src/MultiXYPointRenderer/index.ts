import { lazy } from 'react'

import MultiXYPointRenderer from './MultiXYPointRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiXYPointRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiXYPointRenderer({
        name: 'MultiXYPointRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
