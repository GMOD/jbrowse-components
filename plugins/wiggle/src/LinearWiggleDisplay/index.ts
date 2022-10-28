import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './models/configSchema'
import modelFactory from './models/model'
import ReactComponent from './components/WiggleDisplayComponent'
import Tooltip from './components/Tooltip'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const stateModel = modelFactory(pluginManager, configSchema)
    return new DisplayType({
      name: 'LinearWiggleDisplay',
      configSchema,
      stateModel,
      trackType: 'QuantitativeTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}

export { ReactComponent, modelFactory, Tooltip }
