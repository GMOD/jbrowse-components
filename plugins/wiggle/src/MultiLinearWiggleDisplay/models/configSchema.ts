import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import sharedWiggleConfigFactory from '../../shared/configShared'

/**
 * #config MultiLinearWiggleDisplay
 * extends
 * - [SharedWiggleDisplay](../sharedwiggledisplay)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function WiggleConfigFactory(pluginManager: PluginManager) {
  const MultiXYPlotRendererConfigSchema = pluginManager.getRendererType(
    'MultiXYPlotRenderer',
  ).configSchema
  const MultiDensityRendererConfigSchema = pluginManager.getRendererType(
    'MultiDensityRenderer',
  ).configSchema
  const MultiRowXYPlotRendererConfigSchema = pluginManager.getRendererType(
    'MultiRowXYPlotRenderer',
  ).configSchema
  const MultiLineRendererConfigSchema =
    pluginManager.getRendererType('MultiLineRenderer').configSchema
  const MultiRowLineRendererConfigSchema = pluginManager.getRendererType(
    'MultiRowLineRenderer',
  ).configSchema

  return ConfigurationSchema(
    'MultiLinearWiggleDisplay',
    {
      /**
       * #slot
       */
      defaultRendering: {
        defaultValue: 'multirowxy',
        model: types.enumeration('Rendering', [
          'multirowxy',
          'xyplot',
          'multirowdensity',
          'multiline',
          'multirowline',
        ]),
        type: 'stringEnum',
      },

      /**
       * #slot
       */
      height: {
        defaultValue: 200,
        type: 'number',
      },

      /**
       * #slot
       */
      renderers: ConfigurationSchema('RenderersConfiguration', {
        MultiDensityRenderer: MultiDensityRendererConfigSchema,
        MultiLineRenderer: MultiLineRendererConfigSchema,
        MultiRowLineRenderer: MultiRowLineRendererConfigSchema,
        MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
        MultiXYPlotRenderer: MultiXYPlotRendererConfigSchema,
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
