import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BreakpointSplitViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(
        () => import('./components/BreakpointSplitView.tsx'),
      ),
    })
  })
}
