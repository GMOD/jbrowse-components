import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config MultiLinearWiggleDisplay
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
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
      },

      /**
       * #slot
       */
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'use the minimal amount of ticks',
      },

      /**
       * #slot
       */
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      },
      /**
       * #slot
       */
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      /**
       * #slot
       */
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
      },
      /**
       * #slot
       */
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },

      /**
       * #slot
       */
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },

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
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}
