import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'

export function LinearVariantDisplayConfigFactory(
  pluginManager: PluginManager,
) {
  const PileupRendererConfigSchema = pluginManager.getRendererType(
    'PileupRenderer',
  ).configSchema
  const SvgFeatureRendererConfigSchema = pluginManager.getRendererType(
    'SvgFeatureRenderer',
  ).configSchema

  return ConfigurationSchema(
    'LinearVariantDisplay',
    {
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup', 'svg']),
        defaultValue: 'svg',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
        SvgFeatureRenderer: SvgFeatureRendererConfigSchema,
      }),
    },
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}

export type LinearVariantDisplayConfigModel = ReturnType<
  typeof LinearVariantDisplayConfigFactory
>
export type LinearVariantDisplayConfig = Instance<
  LinearVariantDisplayConfigModel
>
