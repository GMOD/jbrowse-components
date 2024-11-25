import { lazy } from 'react'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { stateModelFactory } from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearGenomeView',
      displayName: 'Linear genome view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearGenomeView')),
    })
  })
}

export * from './model'
