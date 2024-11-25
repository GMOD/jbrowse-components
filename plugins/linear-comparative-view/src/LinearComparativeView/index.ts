import { lazy } from 'react'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import modelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearComparativeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearComparativeView',
      viewMetadata: {
        hiddenFromGUI: true,
      },
      displayName: 'Linear comparative view',
      stateModel: modelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearComparativeView')),
    })
  })
}
