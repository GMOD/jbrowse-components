import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import MultiVariantBaseDisplayComponent from '../shared/components/MultiVariantBaseDisplayComponent.tsx'
import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiWebGLVariantDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'MultiLinearVariantDisplay',
      displayName: 'Multi-sample variant display (regular)',
      helpText:
        'WebGL accelerated multi-sample variant display. Draws variants at their actual base pair coordinates with GPU-accelerated rendering for smooth scrolling.',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: MultiVariantBaseDisplayComponent,
    })
  })
}
