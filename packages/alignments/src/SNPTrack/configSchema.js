import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

export default pluginManager => {
  // const XYPlotRendererConfigSchema = pluginManager.getRendererType(
  //   'XYPlotRenderer',
  // ).configSchema
  // const DensityRendererConfigSchema = pluginManager.getRendererType(
  //   'DensityRenderer',
  // ).configSchema
  // const LinePlotRendererConfigSchema = pluginManager.getRendererType(
  //   'LinePlotRenderer',
  // ).configSchema
  const SNPXYRendererConfigSchema = pluginManager.getRendererType(
    'SNPXYRenderer',
  ).configSchema

  return ConfigurationSchema(
    'SNPTrack',
    {
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['global', 'local']),
        description: 'performs local or global autoscaling',
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
        model: types.enumeration('Rendering', ['snpxy']),
        defaultValue: 'snpxy',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPXYRenderer: SNPXYRendererConfigSchema,
      }),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}
