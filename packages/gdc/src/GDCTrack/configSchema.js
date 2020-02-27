import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig as LinearGenomeTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

export default pluginManager => {
  // const PileupRendererConfigSchema = pluginManager.getRendererType(
  //   'PileupRenderer',
  // ).configSchema
  // const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
  //   'SvgFeatureRenderer',
  // ).configSchema

  return ConfigurationSchema(
    'GDCTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
      // defaultRendering: {
      //   type: 'stringEnum',
      //   model: types.enumeration('Rendering', ['pileup', 'svg']),
      //   defaultValue: 'svg',
      // },

      // renderers: ConfigurationSchema('RenderersConfiguration', {
      //   PileupRenderer: PileupRendererConfigSchema,
      //   SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
      // }),
    },
    { baseConfiguration: LinearGenomeTrackConfig, explicitlyTyped: true },
  )
}
