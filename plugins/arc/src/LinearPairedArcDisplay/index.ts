import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearPairedArcDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearPairedArcDisplay',
      displayName: 'Variant arc display',
      helpText:
        'Can display arcs connecting SVs and breakends in VCF format or BEDPE pairs',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/ReactComponent')),
    })
  })
}
