import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

function PileupConfigFactory(pluginManager: PluginManager) {
  const PileupRendererConfigSchema = pluginManager.getRendererType(
    'PileupRenderer',
  ).configSchema
  const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema

  // modify config schema to take in a sub coverage display
  return ConfigurationSchema(
    'LinearPileupDisplay',
    {
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
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}

export type LinearPileupDisplayConfigModel = ReturnType<
  typeof PileupConfigFactory
>
export type LinearPileupDisplayConfig = Instance<LinearPileupDisplayConfigModel>
export default PileupConfigFactory
