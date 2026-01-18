import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF1 from './configSchema1.ts'
import configSchemaF2 from './configSchema2.ts'
import stateModelFactory1 from './stateModel1.ts'
import stateModelFactory2 from './stateModel2.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LazyLDDisplayComponent = lazy(
  () => import('./components/LDDisplayComponent.tsx'),
)

export default function LDDisplayF(pluginManager: PluginManager) {
  // LDDisplay for VariantTrack - computes LD from VCF genotypes
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF1(pluginManager)
    return new DisplayType({
      name: 'LDDisplay',
      displayName: 'LD heatmap display',
      helpText:
        'Displays a linkage disequilibrium (LD) heatmap showing pairwise R² values between variants computed directly from VCF genotypes',
      configSchema,
      stateModel: stateModelFactory1(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyLDDisplayComponent,
    })
  })

  // LDTrackDisplay for LDTrack - uses pre-computed LD from PlinkLDAdapter
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF2(pluginManager)
    return new DisplayType({
      name: 'LDTrackDisplay',
      displayName: 'LD heatmap display',
      helpText:
        'Displays a linkage disequilibrium (LD) heatmap from pre-computed LD data (e.g., PLINK --r2 output)',
      configSchema,
      stateModel: stateModelFactory2(configSchema),
      trackType: 'LDTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LazyLDDisplayComponent,
    })
  })
}
