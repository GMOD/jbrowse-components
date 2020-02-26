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
  const SNPCoverageRendererConfigSchema = pluginManager.getRendererType(
    'SNPCoverageRenderer',
  ).configSchema

  return ConfigurationSchema(
    'SNPCoverageTrack',
    {
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', ['local']),
        description:
          'performs local autoscaling (no other options for SNP Coverage available)',
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

      headroom: {
        type: 'number',
        description:
          'round the upper value of the domain scale to the nearest N',
        defaultValue: 20,
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['snpcoverage', 'svg']),
        defaultValue: 'snpcoverage',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        SNPCoverageRenderer: SNPCoverageRendererConfigSchema,
      }),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}
