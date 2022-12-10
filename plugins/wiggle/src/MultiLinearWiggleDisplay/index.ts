import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './models/configSchema'
import modelFactory from './models/model'
import ReactComponent from './components/WiggleDisplayComponent'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'MultiLinearWiggleDisplay',
      displayName: 'Multi-wiggle display',
      configSchema,
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'MultiQuantitativeTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
