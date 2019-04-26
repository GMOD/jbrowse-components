import Plugin from '../../Plugin'

import { DensityRenderer, XYPlotRenderer } from './wiggleRenderer'

export default class WiggleRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(DensityRenderer)
    pluginManager.addRendererType(XYPlotRenderer)
  }
}
