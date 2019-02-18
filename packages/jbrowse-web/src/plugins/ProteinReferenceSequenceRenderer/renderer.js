import Rendering from './components/Rendering'
import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class ProteinReferenceSequenceRenderer extends ServerSideRenderer {}

export default (/* pluginManager */) =>
  new ProteinReferenceSequenceRenderer({
    name: 'ProteinReferenceSequenceRenderer',
    ReactComponent: Rendering,
    configSchema: ConfigSchema,
  })
