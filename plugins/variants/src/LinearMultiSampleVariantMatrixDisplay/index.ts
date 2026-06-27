import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMultiSampleVariantMatrixDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF()
    return new DisplayType({
      name: 'LinearMultiSampleVariantMatrixDisplay',
      displayName: 'Multi-sample variant display (matrix)',
      helpText:
        'GPU accelerated matrix variant display. Draws variants as columns in a heatmap grid with GPU-accelerated rendering for smooth scrolling.',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(
        () => import('./components/VariantMatrixDisplayComponent.tsx'),
      ),
      // renamed from LinearVariantMatrixDisplay; alias remaps old track configs
      // (active display instances are remapped in model.ts preProcessSnapshot)
      aliases: ['LinearVariantMatrixDisplay'],
    })
  })
}
