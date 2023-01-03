import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './models/CircularView'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/CircularView')),
        stateModel: stateModelFactory(pluginManager),
        name: 'CircularView',
        displayName: 'Circular view',
      }),
  )
}
