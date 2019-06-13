import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import Rendering from './components/Rendering'
import ConfigSchema from './configSchema'

class ProteinReferenceSequenceRenderer extends ServerSideRendererType {}

export default (/* pluginManager */) =>
  new ProteinReferenceSequenceRenderer({
    name: 'ProteinReferenceSequenceRenderer',
    ReactComponent: Rendering,
    configSchema: ConfigSchema,
  })
