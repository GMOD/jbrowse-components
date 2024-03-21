import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './models/model'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/CircularView')),
        displayName: 'Circular view',
        name: 'CircularView',
        stateModel: stateModelFactory(pluginManager),
      }),
  )
}
