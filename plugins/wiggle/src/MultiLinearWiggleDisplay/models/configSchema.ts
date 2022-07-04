import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

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

  return ConfigurationSchema(
    'MultiLinearWiggleDisplay',
    {
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
      minimalTicks: {
        type: 'boolean',
        defaultValue: false,
        description: 'use the minimal amount of ticks',
      },

      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
      },
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },

      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', [
          'multirowxy',
          'xyplot',
          'multirowdensity',
          'multiline',
        ]),
        defaultValue: 'multirowxy',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        MultiXYPlotRenderer: MultiXYPlotRendererConfigSchema,
        MultiDensityRenderer: MultiDensityRendererConfigSchema,
        MultiRowXYPlotRenderer: MultiRowXYPlotRendererConfigSchema,
        MultiLineRenderer: MultiLineRendererConfigSchema,
      }),
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}
