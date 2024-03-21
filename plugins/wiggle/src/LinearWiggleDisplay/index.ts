import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './models/configSchema'
import modelFactory from './models/model'
import { lazy } from 'react'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const stateModel = modelFactory(pluginManager, configSchema)
    return new DisplayType({
      ReactComponent: lazy(() => import('./components/WiggleDisplayComponent')),
      configSchema,
      displayName: 'Wiggle display',
      name: 'LinearWiggleDisplay',
      stateModel,
      trackType: 'QuantitativeTrack',
      viewType: 'LinearGenomeView',
    })
  })
}

export { default as Tooltip } from './components/Tooltip'
export { default as ReactComponent } from './components/WiggleDisplayComponent'
export { default as modelFactory } from './models/model'
