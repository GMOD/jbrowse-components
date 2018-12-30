import React from 'react'

import SvgFeatureRendering from './components/SvgFeatureRendering'

import ConfigSchema from './configSchema'
import BoxRenderer from '../../renderers/boxRenderer'

class SvgFeatureRenderer extends BoxRenderer {
  async render(renderProps) {
    const element = React.createElement(this.ReactComponent, renderProps, null)
    return { element }
  }
}

export default (/* pluginManager */) =>
  new SvgFeatureRenderer({
    name: 'SvgFeatureRenderer',
    ReactComponent: SvgFeatureRendering,
    configSchema: ConfigSchema,
  })
