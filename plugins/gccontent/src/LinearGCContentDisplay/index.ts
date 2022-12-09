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
      name: 'LinearGCContentDisplay',
      configSchema,
      stateModel,
      displayName: 'GC content display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
