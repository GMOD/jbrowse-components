import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

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
  const PileupSNPCoverageRendererConfigSchema = pluginManager.getRendererType(
    'PileupSNPCoverageRenderer',
  ).configSchema

  // modify config schema to take in a sub coverage track
  return ConfigurationSchema(
    'AlignmentsTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', [
          'pileup',
          'svg',
          'snpcoverage',
          'pileupsnpcoverage',
        ]),
        defaultValue: 'pileup',
      },
      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
        SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
        // if SNP Coverage is selected, need some way to wrap adapter as subadapter
        // and adapter selection immediately becomes SNPCoverageAdapter
        SNPCoverageRenderer: SNPCoverageRendererConfigSchema,
        PileupSNPCoverageRenderer: PileupSNPCoverageRendererConfigSchema,
      }),
      // coverageTrack: ConfigurationSchema(
      //   'SNPCoverageTrack',
      //   {
      //     SNPCoverageTrack: SNPCoverageTrackConfigSchema(pluginManager),
      //   },
      //   { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
      // ),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}
