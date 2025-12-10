import { lazy } from 'react'

import SvgFeatureRenderer from './SvgFeatureRenderer'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function SvgFeatureRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new SvgFeatureRenderer({
      name: 'SvgFeatureRenderer',
      ReactComponent: lazy(() => import('./components/SvgFeatureRendering')),
      configSchema,
      pluginManager,
    })
  })
}

export { default as ReactComponent } from './components/SvgFeatureRendering'
export { default as configSchema } from './configSchema'
