import Plugin from '../../Plugin'

import WiggleRendering from './components/WiggleRendering'
import { DensityRenderer, XYPlotRenderer } from './wiggleRenderer'
import ConfigSchema from './configSchema'
import { ConfigurationSchema } from '../../configuration'

export default class WiggleRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(
      () =>
        new DensityRenderer({
          name: 'DensityRenderer',
          ReactComponent: WiggleRendering,
          configSchema: ConfigurationSchema(
            'DensityRenderer',
            {},
            { baseConfiguration: ConfigSchema, explicitlyTyped: true },
          ),
        }),
    )
    pluginManager.addRendererType(
      () =>
        new XYPlotRenderer({
          name: 'XYPlotRenderer',
          ReactComponent: WiggleRendering,
          configSchema: ConfigurationSchema(
            'XYPlotRenderer',
            {},
            { baseConfiguration: ConfigSchema, explicitlyTyped: true },
          ),
        }),
    )
  }
}
