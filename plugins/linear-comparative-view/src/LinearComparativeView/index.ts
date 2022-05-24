import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './model'

export default (pluginManager: PluginManager) => {
  const stateModel = stateModelFactory(pluginManager)
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearComparativeView',
        stateModel,
        ReactComponent: lazy(
          () => import('./components/LinearComparativeView'),
        ),
      }),
  )
}
