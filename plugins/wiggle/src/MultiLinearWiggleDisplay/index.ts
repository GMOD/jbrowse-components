import { lazy } from 'react'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema'
import modelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiLinearWiggleDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'MultiLinearWiggleDisplay',
      displayName: 'Multi-wiggle display',
      configSchema,
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'MultiQuantitativeTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/WiggleDisplayComponent')),
    })
  })
}
