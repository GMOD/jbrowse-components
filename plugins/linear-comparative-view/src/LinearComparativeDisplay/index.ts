import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'

import configSchemaFactory from './configSchemaF'
import stateModelFactory from './stateModelFactory'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      ReactComponent: () => {
        return null
      },
      configSchema,
      name: 'LinearComparativeDisplay',
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearComparativeView',
    })
  })
}
