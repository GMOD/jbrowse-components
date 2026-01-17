import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LDDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LDDisplay',
      displayName: 'LD heatmap display',
      helpText:
        'Displays a linkage disequilibrium (LD) heatmap showing pairwise R² values between variants computed directly from VCF genotypes',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(
        () => import('./components/LDDisplayComponent.tsx'),
      ),
    })
  })
}
