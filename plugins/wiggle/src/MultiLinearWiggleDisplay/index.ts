import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './models/configSchema'
import modelFactory from './models/model'
import { lazy } from 'react'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      ReactComponent: lazy(() => import('./components/WiggleDisplayComponent')),
      configSchema,
      displayName: 'Multi-wiggle display',
      name: 'MultiLinearWiggleDisplay',
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'MultiQuantitativeTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
