import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from './components/LinearComparativeDisplay'
import configSchemaFactory from './configSchemaF'
import stateModelFactory from './stateModelFactory'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearComparativeDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearComparativeView',
      ReactComponent,
    })
  })
}

export { ReactComponent }
