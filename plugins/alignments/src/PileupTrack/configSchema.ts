import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

function PileupConfigFactory(pluginManager: PluginManager) {
  const PileupRendererConfigSchema = pluginManager.getRendererType(
    'PileupRenderer',
  ).configSchema
  const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema

  // modify config schema to take in a sub coverage track
  return ConfigurationSchema(
    'PileupTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup', 'svg']),
        defaultValue: 'pileup',
      },
      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
        SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
      }),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}

export type PileupConfigModel = ReturnType<typeof PileupConfigFactory>
export type PileupConfig = Instance<PileupConfigModel>
export default PileupConfigFactory
