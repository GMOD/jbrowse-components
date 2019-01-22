import DivSequenceRendering from './components/DivSequenceRendering'

import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class DivSequenceRenderer extends ServerSideRenderer {}

export default (/* pluginManager */) =>
  new DivSequenceRenderer({
    name: 'DivSequenceRenderer',
    ReactComponent: DivSequenceRendering,
    configSchema: ConfigSchema,
  })
