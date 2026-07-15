import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const VariantDisplayComponent = lazy(
  () => import('./components/VariantDisplayComponent.tsx'),
)

export default function LinearMultiSampleVariantDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMultiSampleVariantDisplay',
      displayName: 'Multi-sample variant display (regular)',
      helpText:
        'GPU accelerated multi-sample variant display. Draws variants at their actual base pair coordinates with GPU-accelerated rendering for smooth scrolling.',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: VariantDisplayComponent,
      // renamed from MultiLinearVariantDisplay; alias remaps old track configs
      // (active display instances are remapped in model.ts preProcessSnapshot)
      aliases: ['MultiLinearVariantDisplay'],
    })
  })
}
