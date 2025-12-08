import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

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
  const MultiXYPointRendererConfigSchema = pluginManager.getRendererType(
    'MultiXYPointRenderer',
  )!.configSchema
  const MultiDensityRendererConfigSchema = pluginManager.getRendererType(
    'MultiDensityRenderer',
  )!.configSchema
  const MultiRowXYPlotRendererConfigSchema = pluginManager.getRendererType(
    'MultiRowXYPlotRenderer',
  )!.configSchema
  const MultiRowXYPointRendererConfigSchema = pluginManager.getRendererType(
    'MultiRowXYPointRenderer',
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
          'multirowxypoint',
          'xypoint',
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
        MultiXYPointRenderer: MultiXYPointRendererConfigSchema,
        MultiDensityRenderer: MultiDensityRendererConfigSchema,
        MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
        MultiRowXYPointRenderer: MultiRowXYPointRendererConfigSchema,
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
