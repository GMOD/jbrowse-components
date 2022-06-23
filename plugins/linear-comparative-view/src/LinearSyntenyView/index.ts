import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import modelFactory from './model'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  return new ViewType({
    name: 'LinearSyntenyView',
    stateModel: jbrequire(modelFactory),
    ReactComponent: lazy(() => import('./components/LinearSyntenyView')),
  })
}
