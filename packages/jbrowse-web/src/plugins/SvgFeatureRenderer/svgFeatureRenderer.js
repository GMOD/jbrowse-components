import React from 'react'

import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import SvgFeatureRendering from './components/SvgFeatureRendering'

import ConfigSchema from './configSchema'

class SvgFeatureRenderer extends BoxRendererType {
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
