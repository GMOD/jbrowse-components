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
      ReactComponent,
      configSchema,
      displayName: 'Alignments display (combination)',
      name: 'LinearAlignmentsDisplay',
      stateModel: modelFactory(pluginManager, configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
    })
  })
}
