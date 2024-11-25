import { lazy } from 'react'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import stateModelFactory from './models/model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function CircularViewF(pluginManager: PluginManager) {
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
