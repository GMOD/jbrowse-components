import { lazy } from 'react'

import PileupRenderer from './PileupRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new PileupRenderer({
      name: 'PileupRenderer',
      displayName: 'Pileup renderer',
      ReactComponent: lazy(() => import('./components/PileupRendering.tsx')),
      configSchema,
      pluginManager,
    })
  })
}
