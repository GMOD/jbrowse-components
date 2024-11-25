import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
// locals
import ReactComponent from './components/AlignmentsDisplay'
import configSchemaFactory from './configSchema'
import modelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearAlignmentsDisplayF(pluginManager: PluginManager) {
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
