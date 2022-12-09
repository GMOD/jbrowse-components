import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import ReactComponent from './components/ReactComponent'
import configSchemaF from './configSchema'
import stateModelF from './model'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearReadCloudDisplay',
      displayName: 'Read cloud display',
      configSchema,
      stateModel: stateModelF(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      subDisplay: { type: 'LinearAlignmentsDisplay', lowerPanel: true },
      ReactComponent,
    })
  })
}
