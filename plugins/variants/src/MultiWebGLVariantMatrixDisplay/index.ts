import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'
import MultiVariantBaseDisplayComponent from '../shared/components/MultiVariantBaseDisplayComponent.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiWebGLVariantMatrixDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearVariantMatrixDisplay',
      displayName: 'Multi-sample variant display (matrix)',
      helpText:
        'WebGL accelerated matrix variant display. Draws variants as columns in a heatmap grid with GPU-accelerated rendering for smooth scrolling.',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: MultiVariantBaseDisplayComponent,
    })
  })
}
