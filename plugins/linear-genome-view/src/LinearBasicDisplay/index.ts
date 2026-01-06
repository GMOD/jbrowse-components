import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearBasicDisplay(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const config = configSchema(pluginManager)
    return new DisplayType({
      name: 'LinearBasicDisplay',
      displayName: 'Basic feature display',
      configSchema: config,
      stateModel: modelFactory(config),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(
        () => import('./components/LinearBasicDisplayComponent.tsx'),
      ),
    })
  })
}

export { default as modelFactory } from './model.ts'
export { default as configSchema } from './configSchema.ts'
