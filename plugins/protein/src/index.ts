import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  configSchema as proteinReferenceSequenceTrackRendererConfigSchema,
  ReactComponent as ProteinReferenceSequenceTrackRendererReactComponent,
} from './ProteinReferenceSequenceRenderer'

export default class extends Plugin {
  name = 'ProteinsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new ServerSideRendererType({
          name: 'ProteinReferenceSequenceTrackRenderer',
          ReactComponent: ProteinReferenceSequenceTrackRendererReactComponent,
          configSchema: proteinReferenceSequenceTrackRendererConfigSchema,
        }),
    )
  }
}
