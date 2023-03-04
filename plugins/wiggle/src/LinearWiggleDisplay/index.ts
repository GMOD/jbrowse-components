import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './models/configSchema'
import modelFactory from './models/model'
import ReactComponent from './components/WiggleDisplayComponent'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const stateModel = modelFactory(pluginManager, configSchema)
    return new DisplayType({
      name: 'LinearWiggleDisplay',
      displayName: 'Wiggle display',
      configSchema,
      stateModel,
      trackType: 'QuantitativeTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}

export { default as Tooltip } from './components/Tooltip'
export { default as ReactComponent } from './components/WiggleDisplayComponent'
export { default as modelFactory } from './models/model'
