import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import modelFactory from './model'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const ViewType = jbrequire('@jbrowse/core/pluggableElementTypes/ViewType')

  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearSyntenyView',
        stateModel: jbrequire(modelFactory),
        ReactComponent: lazy(() => import('./components/LinearSyntenyView')),
      }),
  )
}
