import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import Rendering from './components/Rendering'
import ConfigSchema from './configSchema'

class ProteinReferenceSequenceTrackRenderer extends ServerSideRendererType {}

export default (/* pluginManager */) =>
  new ProteinReferenceSequenceTrackRenderer({
    name: 'ProteinReferenceSequenceTrackRenderer',
    ReactComponent: Rendering,
    configSchema: ConfigSchema,
  })
