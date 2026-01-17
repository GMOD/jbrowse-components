import { lazy } from 'react'

import LDRenderer from './LDRenderer.tsx'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LDRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LDRenderer({
        name: 'LDRenderer',
        ReactComponent: lazy(() => import('./components/LDRendering.tsx')),
        configSchema,
        pluginManager,
      }),
  )
}
