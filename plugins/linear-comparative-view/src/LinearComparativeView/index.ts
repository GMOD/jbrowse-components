import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import modelFactory from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new ViewType({
      ReactComponent: lazy(() => import('./components/LinearComparativeView')),
      displayName: 'Linear comparative view',
      name: 'LinearComparativeView',
      stateModel: modelFactory(pluginManager),
    })
  })
}
