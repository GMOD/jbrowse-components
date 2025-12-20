import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema'
import modelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiLinearVariantDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'MultiLinearVariantDisplay',
      displayName: 'Multi-sample variant display (regular)',
      helpText:
        'Draws multi-sample variant data using a row for each sample in your dataset. The term "regular" is unfortunately vague but it just means drawing the variants at their actual base pair coordinates. The "regular" mode is notable for also being able to draw structural variants (SVs), including overlapping SVs. It will specifically skip drawing the "reference" alleles by default, allowing overlapping SVs to not cover each other up',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(
        () => import('./components/VariantDisplayComponent'),
      ),
    })
  })
}
