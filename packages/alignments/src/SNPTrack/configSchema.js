import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view' // change base config
import { types } from 'mobx-state-tree'

// Will be exporting wiggle track instead
export default pluginManager => {
  const PileupRendererConfigSchema = pluginManager.getRendererType(
    'PileupRenderer',
  ).configSchema
  const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema

  return ConfigurationSchema(
    'SNPTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup', 'svg']), // needs change
        defaultValue: 'pileup', // needs change
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
        SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
      }),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}
