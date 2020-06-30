import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  configSchema as proteinReferenceSequenceTrackRendererConfigSchema,
  ReactComponent as ProteinReferenceSequenceTrackRendererReactComponent,
} from './ProteinReferenceSequenceRenderer'

export default class extends Plugin {
  name = 'ProteinsPlugin'

  install(pluginManager) {
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
