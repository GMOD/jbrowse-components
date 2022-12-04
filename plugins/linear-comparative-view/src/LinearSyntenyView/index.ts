import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import modelFactory from './model'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyView',
      displayName: 'Linear synteny view',
      stateModel: modelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearSyntenyView')),
    })
  })
}
