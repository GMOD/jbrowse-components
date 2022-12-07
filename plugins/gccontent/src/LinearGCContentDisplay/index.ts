import PluginManager from '@jbrowse/core/PluginManager'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import configSchemaFactory from './config'
import stateModelFactory from './stateModel'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const stateModel = stateModelFactory(pluginManager, configSchema)
    return {
      name: 'LinearGCContentDisplay',
      configSchema,
      stateModel,
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    }
  })
}
