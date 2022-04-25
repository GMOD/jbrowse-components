import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { linearBasicDisplayConfigSchemaFactory } from '@jbrowse/plugin-linear-genome-view'
import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

function PileupConfigFactory(pluginManager: PluginManager) {
  const PileupRendererConfigSchema =
    pluginManager.getRendererType('PileupRenderer').configSchema

  // modify config schema to take in a sub coverage display
  return ConfigurationSchema(
    'LinearPileupDisplay',
    {
      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['pileup']),
        defaultValue: 'pileup',
      },
      renderers: ConfigurationSchema('RenderersConfiguration', {
        PileupRenderer: PileupRendererConfigSchema,
      }),
      renderer: '',
      maxFeatureScreenDensity: {
        type: 'number',
        description: 'maximum features per pixel that is displayed in the view',
        defaultValue: 5,
      },
      colorScheme: {
        type: 'stringEnum',
        model: types.enumeration('colorScheme', [
          'strand',
          'normal',
          'insertSize',
          'insertSizeAndOrientation',
          'mappingQuality',
          'tag',
        ]),
        description: 'color scheme to use',
        defaultValue: 'normal',
      },
    },
    {
      baseConfiguration: linearBasicDisplayConfigSchemaFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export type LinearPileupDisplayConfigModel = ReturnType<
  typeof PileupConfigFactory
>
export type LinearPileupDisplayConfig = Instance<LinearPileupDisplayConfigModel>
export default PileupConfigFactory
