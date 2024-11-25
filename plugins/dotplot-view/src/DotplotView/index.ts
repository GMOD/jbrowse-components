import { lazy } from 'react'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
// locals
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'DotplotView',
      displayName: 'Dotplot view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/DotplotView')),
    })
  })
}
