import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'
import stateModelF from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiLGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    return new DisplayType({
      name: 'MultiLGVSyntenyDisplay',
      configSchema,
      stateModel,
      trackType: 'MultiSyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/Component.tsx')),
    })
  })
}
