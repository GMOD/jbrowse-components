import { lazy } from 'react'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import PluginManager from '@jbrowse/core/PluginManager'
// locals
import stateModelFactory from './model'

export default function (pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'DotplotView',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/DotplotView')),
    })
  })
}
