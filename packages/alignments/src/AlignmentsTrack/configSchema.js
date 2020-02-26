import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

export default pluginManager => {
  // const pileupTrackConfigSchema = pluginManager.getTrackType('PileupTrack')
  //   .configSchema
  // const snpCoverageTrackConfigSchema = pluginManager.getTrackType(
  //   'SNPCoverageTrack',
  // ).configSchema
  const PileupRendererConfigSchema = pluginManager.getRendererType(
    'PileupRenderer',
  ).configSchema
  const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema
  const SNPCoverageRendererConfigSchema = pluginManager.getRendererType(
    'SNPCoverageRenderer',
  ).configSchema

  return ConfigurationSchema(
    'AlignmentsTrack',
    {
      // pileupTrackConfig: pileupTrackConfigSchema,
      // snpCoverageTrackConfig: snpCoverageTrackConfigSchema,
      coverageTrackOptions: ConfigurationSchema('coverageConfig', {
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
          model: types.enumeration('Scale type', ['linear', 'log']),
          description: 'The type of scale to use',
          defaultValue: 'linear',
        },
        headroom: {
          type: 'number',
          description:
            'round the upper value of the domain scale to the nearest N',
          defaultValue: 20,
        },
      }),
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup', 'svg']),
        defaultValue: 'pileup',
      },
      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
        SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
        SNPCoverageRenderer: SNPCoverageRendererConfigSchema,
      }),
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )
}
