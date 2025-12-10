import { lazy } from 'react'

import XYPlotRenderer from './XYPlotRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function XYPlotRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new XYPlotRenderer({
      name: 'XYPlotRenderer',
      ReactComponent: lazy(() => import('../WiggleRendering')),
      configSchema,
      pluginManager,
    })
  })
}

export { default as XYPlotRenderer } from './XYPlotRenderer'
export { default as ReactComponent } from '../WiggleRendering'
export { default as configSchema } from './configSchema'
