import { lazy } from 'react'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import modelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyView',
      displayName: 'Linear synteny view',
      stateModel: modelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/LinearSyntenyView')),
    })
  })
}
