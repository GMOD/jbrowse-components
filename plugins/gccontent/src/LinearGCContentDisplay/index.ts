import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import configSchemaFactory1 from './config1'
import configSchemaFactory2 from './config2'
import stateModelF1 from './stateModel1'
import stateModelF2 from './stateModel2'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearGCContentDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory1(pluginManager)
    const stateModel = stateModelF1(pluginManager, configSchema)
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

  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory2(pluginManager)
    const stateModel = stateModelF2(pluginManager, configSchema)
    return new DisplayType({
      name: 'LinearGCContentTrackDisplay',
      configSchema,
      stateModel,
      displayName: 'GC content display',
      trackType: 'GCContentTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
