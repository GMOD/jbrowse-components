import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { stateModelFactory } from './model'

export default function LinearGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      ReactComponent: lazy(() => import('./components/LinearGenomeView')),
      displayName: 'Linear genome view',
      name: 'LinearGenomeView',
      stateModel: stateModelFactory(pluginManager),
    })
  })
}

export * from './model'
