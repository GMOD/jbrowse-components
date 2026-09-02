import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { linearSyntenyLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    const stateModel = (): Promise<ViewTypeRegistry['LinearSyntenyView']> =>
      import('./model.ts').then(f => f.default(pluginManager))
    return new ViewType({
      name: 'LinearSyntenyView',
      displayName: 'Linear synteny view',
      stateModel,
      launchKeys: linearSyntenyLaunchKeys,
      ReactComponent: lazy(() => import('./components/LinearSyntenyView.tsx')),
    })
  })
}
