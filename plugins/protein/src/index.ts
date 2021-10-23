import FeatureRendererType from '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchema as proteinReferenceSequenceTrackRendererConfigSchema,
  ReactComponent as ProteinReferenceSequenceTrackRendererReactComponent,
} from './ProteinReferenceSequenceRenderer'

export default class extends Plugin {
  name = 'ProteinsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new FeatureRendererType({
          name: 'ProteinReferenceSequenceTrackRenderer',
          ReactComponent: ProteinReferenceSequenceTrackRendererReactComponent,
          configSchema: proteinReferenceSequenceTrackRendererConfigSchema,
          pluginManager,
        }),
    )
  }
}
