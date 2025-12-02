import { lazy } from 'react'

import PileupRenderer from './PileupRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new PileupRenderer({
      name: 'PileupRenderer',
      displayName: 'Pileup renderer',
      ReactComponent: lazy(() => import('./components/PileupRendering')),
      configSchema,
      pluginManager,
    })
  })
}
