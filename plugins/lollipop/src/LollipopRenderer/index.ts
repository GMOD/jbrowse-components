import PluginManager from '@jbrowse/core/PluginManager'
import { lazy } from 'react'
import LollipopRenderer from './LollipopRenderer'
import configSchema from './configSchema'

export default function LollipopRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LollipopRenderer({
        name: 'LollipopRenderer',
        ReactComponent: lazy(() => import('./components/LollipopRendering')),
        configSchema,
        pluginManager,
      }),
  )
}
