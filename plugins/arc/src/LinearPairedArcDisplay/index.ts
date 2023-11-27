import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema'
import { stateModelFactory } from './model'
import { lazy } from 'react'

export default function LinearPairedArcDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearPairedArcDisplay',
      displayName: 'Arc display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/ReactComponent')),
    })
  })
}
