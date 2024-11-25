import { lazy } from 'react'
import LollipopRenderer from './LollipopRenderer'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

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
