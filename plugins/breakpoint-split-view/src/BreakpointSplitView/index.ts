import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { breakpointSplitLaunchKeys } from './launchKeys.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function BreakpointSplitViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    const stateModel: ViewTypeRegistry['BreakpointSplitView'] =
      stateModelFactory(pluginManager)
    return new ViewType({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      stateModel,
      launchKeys: breakpointSplitLaunchKeys,
      ReactComponent: lazy(
        () => import('./components/BreakpointSplitView.tsx'),
      ),
    })
  })
}
