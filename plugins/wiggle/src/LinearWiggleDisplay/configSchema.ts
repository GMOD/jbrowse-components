import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

// locals
import sharedWiggleConfigFactory from '../shared/SharedWiggleConfigSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearWiggleDisplay
 * extends
 * - [SharedWiggleDisplay](../sharedwiggledisplay)
 */
export default function WiggleConfigFactory(pluginManager: PluginManager) {
  const XYPlotRendererConfigSchema =
    pluginManager.getRendererType('XYPlotRenderer')!.configSchema
  const DensityRendererConfigSchema =
    pluginManager.getRendererType('DensityRenderer')!.configSchema
  const LinePlotRendererConfigSchema =
    pluginManager.getRendererType('LinePlotRenderer')!.configSchema

  return ConfigurationSchema(
    'LinearWiggleDisplay',
    {
      /**
       * #slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['density', 'xyplot', 'line']),
        defaultValue: 'xyplot',
      },
      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        DensityRenderer: DensityRendererConfigSchema,
        XYPlotRenderer: XYPlotRendererConfigSchema,
        LinePlotRenderer: LinePlotRendererConfigSchema,
      }),
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: sharedWiggleConfigFactory(),
      explicitlyTyped: true,
    },
  )
}
