import { lazy } from 'react'

import MultiRowXYPointRenderer from './MultiRowXYPointRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiRowXYPointRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new MultiRowXYPointRenderer({
        name: 'MultiRowXYPointRenderer',
        ReactComponent: lazy(() => import('../MultiWiggleRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
