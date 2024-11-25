import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

// locals
import sharedWiggleConfigFactory from '../shared/SharedWiggleConfigSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MultiLinearWiggleDisplay
 * extends
 * - [SharedWiggleDisplay](../sharedwiggledisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function WiggleConfigFactory(pluginManager: PluginManager) {
  const MultiXYPlotRendererConfigSchema = pluginManager.getRendererType(
    'MultiXYPlotRenderer',
  )!.configSchema
  const MultiDensityRendererConfigSchema = pluginManager.getRendererType(
    'MultiDensityRenderer',
  )!.configSchema
  const MultiRowXYPlotRendererConfigSchema = pluginManager.getRendererType(
    'MultiRowXYPlotRenderer',
  )!.configSchema
  const MultiLineRendererConfigSchema =
    pluginManager.getRendererType('MultiLineRenderer')!.configSchema
  const MultiRowLineRendererConfigSchema = pluginManager.getRendererType(
    'MultiRowLineRenderer',
  )!.configSchema

  return ConfigurationSchema(
    'MultiLinearWiggleDisplay',
    {
      /**
       * #slot
       */
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', [
          'multirowxy',
          'xyplot',
          'multirowdensity',
          'multiline',
          'multirowline',
        ]),
        defaultValue: 'multirowxy',
      },

      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        MultiXYPlotRenderer: MultiXYPlotRendererConfigSchema,
        MultiDensityRenderer: MultiDensityRendererConfigSchema,
        MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
        MultiLineRenderer: MultiLineRendererConfigSchema,
        MultiRowLineRenderer: MultiRowLineRendererConfigSchema,
      }),

      /**
       * #slot
       */
      height: {
        type: 'number',
        defaultValue: 200,
      },
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
