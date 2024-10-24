import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import modelFactory from './model'

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
