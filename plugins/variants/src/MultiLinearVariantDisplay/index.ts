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
