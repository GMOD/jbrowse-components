import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ReactComponent = lazy(
  () => import('./components/LinearMafDisplayComponent.tsx'),
)

export default function LinearMafDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelFactory(configSchema)
    return new DisplayType({
      name: 'LinearMafDisplay',
      configSchema,
      stateModel,
      ReactComponent,
      viewType: 'LinearGenomeView',
      trackType: 'MafTrack',
      displayName: 'MAF display',
    })
  })
}
