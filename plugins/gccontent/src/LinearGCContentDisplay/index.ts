import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import configSchemaFactory from './config'
import stateModelFactory from './stateModel'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    const stateModel = stateModelFactory(pluginManager, configSchema)
    return new DisplayType({
      ReactComponent: LinearWiggleDisplayReactComponent,
      configSchema,
      displayName: 'GC content display',
      name: 'LinearGCContentDisplay',
      stateModel,
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
