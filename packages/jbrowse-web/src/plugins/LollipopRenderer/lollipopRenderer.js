import LollipopRendering from './components/LollipopRendering'

import ConfigSchema from './configSchema'
import BoxRenderer from '../../renderers/boxRenderer'

class LollipopRenderer extends BoxRenderer {}

export default (/* pluginManager */) =>
  new LollipopRenderer({
    name: 'LollipopRenderer',
    ReactComponent: LollipopRendering,
    configSchema: ConfigSchema,
  })
