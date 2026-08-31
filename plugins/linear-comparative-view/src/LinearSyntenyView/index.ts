import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { linearSyntenyLaunchKeys } from './launchKeys.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyView',
      displayName: 'Linear synteny view',
      stateModel: modelFactory(pluginManager),
      launchKeys: linearSyntenyLaunchKeys,
      ReactComponent: lazy(() => import('./components/LinearSyntenyView.tsx')),
    })
  })
}
