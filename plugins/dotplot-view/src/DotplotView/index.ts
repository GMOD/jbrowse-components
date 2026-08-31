import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { dotplotLaunchKeys } from './launchKeys.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'DotplotView',
      displayName: 'Dotplot view',
      stateModel: stateModelFactory(pluginManager),
      launchKeys: dotplotLaunchKeys,
      ReactComponent: lazy(() => import('./components/DotplotView.tsx')),
    })
  })
}
