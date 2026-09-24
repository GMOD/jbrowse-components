import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchemaFactory from './configSchema.ts'
import { foldRetiredMatrixDisplay } from './retiredMatrixDisplay.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const VariantDisplayComponent = lazyWithPreload(
  () => import('./components/VariantDisplayComponent.tsx'),
)

export default function LinearMultiSampleVariantDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'Core-preProcessTrackConfig',
    foldRetiredMatrixDisplay,
  )
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMultiSampleVariantDisplay',
      displayName: 'Multi-sample variant display',
      helpText:
        'One row per sample (or haplotype), each variant drawn at its genomic position or as one of a row of equal-width columns',
      configSchema,
      // lazily loaded: the multi-sample base model and its genotype machinery
      // are fetched when a variant track picks this display or a session names
      // it
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: VariantDisplayComponent,
      // renamed from MultiLinearVariantDisplay; alias remaps old track configs
      // (active display instances are remapped in model.ts preProcessSnapshot)
      aliases: [
        'MultiLinearVariantDisplay',
        'LinearMultiSampleVariantMatrixDisplay',
        'LinearVariantMatrixDisplay',
      ],
    })
  })
}
