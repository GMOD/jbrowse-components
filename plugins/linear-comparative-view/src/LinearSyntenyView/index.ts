import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import modelFactory from './model'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new ViewType({
      ReactComponent: lazy(() => import('./components/LinearSyntenyView')),
      displayName: 'Linear synteny view',
      name: 'LinearSyntenyView',
      stateModel: modelFactory(pluginManager),
    })
  })
}
