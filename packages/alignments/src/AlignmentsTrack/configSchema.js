import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { configSchemaFactory as SNPCoverageTrackConfigSchema } from '../SNPCoverageTrack'

export default pluginManager => {
  const PileupRendererConfigSchema = pluginManager.getRendererType(
    'PileupRenderer',
  ).configSchema
  const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema
  const SNPCoverageRendererConfigSchema = pluginManager.getRendererType(
    'SNPCoverageRenderer',
  ).configSchema
  // const SNPCoverageTrackConfigSchema = pluginManager.getTrackType(
  //   'SNPCoverageTrack',
  // ).configSchema

  // modify config schema to take in a sub coverage track
  return ConfigurationSchema(
    'AlignmentsTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup', 'svg', 'snpcoverage']),
        defaultValue: 'pileup',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
        SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
        SNPCoverageRenderer: SNPCoverageRendererConfigSchema,
      }),
      coverageTrack: ConfigurationSchema('CoverageTrackConfiguration', {
        SNPCoverageTrack: SNPCoverageTrackConfigSchema(pluginManager),
      }),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}
