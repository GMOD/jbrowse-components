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
      ReactComponent,
      configSchema,
      displayName: 'Read cloud display',
      name: 'LinearReadCloudDisplay',
      stateModel: stateModelF(configSchema),
      subDisplay: { lowerPanel: true, type: 'LinearAlignmentsDisplay' },
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
