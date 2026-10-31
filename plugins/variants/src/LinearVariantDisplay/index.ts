import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchemaFactory from './configSchema.ts'
import { VARIANT_PLOT_EXAMPLES } from './plotExamples.ts'
import { retiredState, retiredTypes } from './retired.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const VariantDisplayComponent = lazyWithPreload(
  () => import('./components/VariantDisplayComponent.tsx'),
)

export default function LinearVariantDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearVariantDisplay',
      displayName: 'Variant display',
      helpText:
        'The records stacked as on a feature track, over one row per sample (or haplotype) with each variant drawn at its genomic position or as one of a row of equal-width columns',
      configSchema,
      // lazily loaded: the model, its genotype machinery and the records
      // band's feature pipeline are fetched when a variant track opens
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'VariantTrack',
      rpcMethods: ['MultiSampleVariantGetCellData'],
      viewType: 'LinearGenomeView',
      plotExamples: VARIANT_PLOT_EXAMPLES,
      ReactComponent: VariantDisplayComponent,
      retiredState,
      retiredTypes,
    })
  })
}
