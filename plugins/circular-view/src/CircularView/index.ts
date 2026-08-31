import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { circularLaunchKeys } from './launchKeys.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CircularViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/CircularView.tsx')),
        stateModel: stateModelFactory(pluginManager),
        launchKeys: circularLaunchKeys,
        name: 'CircularView',
        displayName: 'Circular view',
      }),
  )
}
