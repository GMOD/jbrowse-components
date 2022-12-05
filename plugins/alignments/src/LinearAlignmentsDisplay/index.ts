import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'
// locals
import configSchemaFactory from './models/configSchema'
import modelFactory from './models/model'
import ReactComponent from './components/AlignmentsDisplay'

export default function (pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearAlignmentsDisplay',
      displayName: 'Alignments display (combination)',
      configSchema,
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
