import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import modelFactory from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearComparativeView',
      displayName: 'Linear comparative view',
      stateModel: modelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearComparativeView')),
    })
  })
}
