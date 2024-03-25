import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'

import configSchemaFactory1 from './config1'
import configSchemaFactory2 from './config2'
import stateModelF1 from './stateModel1'
import stateModelF2 from './stateModel2'

export default (pluginManager: PluginManager) => {
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
      name: 'LinearGCContentDisplay2',
      configSchema,
      stateModel,
      displayName: 'GC content display',
      trackType: 'GCContentTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearWiggleDisplayReactComponent,
    })
  })
}
