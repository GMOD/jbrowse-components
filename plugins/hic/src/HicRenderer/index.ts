import { lazy } from 'react'

import HicRenderer from './HicRenderer.tsx'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function HicRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new HicRenderer({
        name: 'HicRenderer',
        ReactComponent: lazy(() => import('./components/HicRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
