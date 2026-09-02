import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { linearSyntenyLaunchKeys } from './launchKeys.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    const stateModel: ViewTypeRegistry['LinearSyntenyView'] =
      modelFactory(pluginManager)
    return new ViewType({
      name: 'LinearSyntenyView',
      displayName: 'Linear synteny view',
      stateModel,
      launchKeys: linearSyntenyLaunchKeys,
      ReactComponent: lazy(() => import('./components/LinearSyntenyView.tsx')),
    })
  })
}
