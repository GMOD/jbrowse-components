import ServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import DivSequenceRendering from './components/DivSequenceRendering'

import ConfigSchema from './configSchema'

class DivSequenceRenderer extends ServerSideRendererType {}

export default (/* pluginManager */) =>
  new DivSequenceRenderer({
    name: 'DivSequenceRenderer',
    ReactComponent: DivSequenceRendering,
    configSchema: ConfigSchema,
  })
