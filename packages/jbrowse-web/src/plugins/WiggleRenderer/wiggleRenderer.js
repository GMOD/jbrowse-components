import WiggleRendering from './components/WiggleRendering'

import ConfigSchema from './configSchema'
import ServerSideRenderer from '../../renderers/serverSideRenderer'

class WiggleRenderer extends ServerSideRenderer {}

export default (/* pluginManager */) =>
  new WiggleRenderer({
    name: 'WiggleRenderer',
    ReactComponent: WiggleRendering,
    configSchema: ConfigSchema,
  })
