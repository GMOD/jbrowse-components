import PluginManager from '@jbrowse/core/PluginManager'
import PileupRenderer from './PileupRenderer'
import configSchema from './configSchema'
import { lazy } from 'react'

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
