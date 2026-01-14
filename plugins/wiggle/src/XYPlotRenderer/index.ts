import { lazy } from 'react'

import XYPlotRenderer from './XYPlotRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function XYPlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new XYPlotRenderer({
      name: 'XYPlotRenderer',
      ReactComponent: lazy(() => import('../WiggleRendering.tsx')),
      configSchema,
      pluginManager,
    })
  })
}

export { default as XYPlotRenderer } from './XYPlotRenderer.ts'
export { default as ReactComponent } from '../WiggleRendering.tsx'
export { default as configSchema } from './configSchema.ts'
