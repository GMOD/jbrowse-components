import React from 'react'

import DivSequenceRendering from './components/DivSequenceRendering'

import ConfigSchema from './configSchema'
import BoxRenderer from '../../renderers/boxRenderer'

class DivSequenceRenderer extends BoxRenderer {
  async render(renderProps) {
    const element = React.createElement(this.ReactComponent, renderProps, null)
    return { element }
  }
}

export default (/* pluginManager */) =>
  new DivSequenceRenderer({
    name: 'DivSequenceRenderer',
    ReactComponent: DivSequenceRendering,
    configSchema: ConfigSchema,
  })
