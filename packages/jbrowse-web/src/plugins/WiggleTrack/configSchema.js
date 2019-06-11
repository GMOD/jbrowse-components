import { types } from 'mobx-state-tree'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'

export default pluginManager => {
  const XYPlotRendererConfigSchema = pluginManager.getRendererType(
    'XYPlotRenderer',
  ).configSchema
  const DensityRendererConfigSchema = pluginManager.getRendererType(
    'DensityRenderer',
  ).configSchema

  return ConfigurationSchema(
    'WiggleTrack',
    {
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'global',
        model: types.enumeration('Autoscale type', ['global', 'local']),
        description: 'performs local or global autoscaling',
      },
      minScore: {
        type: 'number',
        defaultValue: -Infinity,
        description: 'minimum value for the y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Infinity,
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
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['density', 'xyplot']),
        defaultValue: 'xyplot',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        DensityRenderer: DensityRendererConfigSchema,
        XYPlotRenderer: XYPlotRendererConfigSchema,
      }),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}
