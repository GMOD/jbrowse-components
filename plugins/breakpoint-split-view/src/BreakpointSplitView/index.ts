import { lazy } from 'react'

import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BreakpointSplitViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      stateModel: () =>
        import('./model.ts').then(f => f.default(pluginManager)),
      ReactComponent: lazy(
        () => import('./components/BreakpointSplitView.tsx'),
      ),
    })
  })
}
