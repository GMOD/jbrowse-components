import PluginManager from '@jbrowse/core/PluginManager'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

// locals
import ReactComponent from './components/ReactComponent'
import configSchemaF from './configSchema'
import modelF from './model'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearAlignmentsArcsDisplay',
      configSchema,
      stateModel: modelF(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
