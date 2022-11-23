import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { stateModelFactory } from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearGenomeView',
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(() => import('./components/LinearGenomeView')),
      }),
  )
}

export * from './model'
