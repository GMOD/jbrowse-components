import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'
import {
  RETIRED_ROW_STATE_KEYS,
  liftRetiredRowState,
} from '@jbrowse/display-kit/retiredSettings'

import configSchemaFactory from './configSchema.ts'
import { MULTI_SAMPLE_VARIANT_PLOT_EXAMPLES } from './plotExamples.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const VariantDisplayComponent = lazyWithPreload(
  () => import('./components/VariantDisplayComponent.tsx'),
)

export default function LinearMultiSampleVariantDisplayF(
  pluginManager: PluginManager,
) {
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
      plotExamples: MULTI_SAMPLE_VARIANT_PLOT_EXAMPLES,
      ReactComponent: VariantDisplayComponent,
      // A v4 layout copied the colorBy palette into its rows, so its
      // colours stay behind and the palette keeps painting them. Its
      // `jexlFilters` lands as the config's own retired spelling, which
      // `retiredFilterSpelling` then renames and prefixes.
      retiredState: {
        keys: [...RETIRED_ROW_STATE_KEYS, 'jexlFilters'],
        lift: instance => ({
          ...liftRetiredRowState(instance, { colors: false }),
          ...(Array.isArray(instance.jexlFilters)
            ? { jexlFilters: instance.jexlFilters }
            : {}),
        }),
      },
      retiredTypes: [
        { type: 'MultiLinearVariantDisplay' },
        {
          type: 'LinearVariantMatrixDisplay',
          migrate: (entry: Record<string, unknown>) => ({
            ...entry,
            variantLayout: 'columns',
          }),
        },
      ],
    })
  })
}
