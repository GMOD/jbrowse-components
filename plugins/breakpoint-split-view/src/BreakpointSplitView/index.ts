import { lazy } from 'react'

// locals
import BreakpointSplitView from './BreakpointSplitView'
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function BreakpointSplitViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new BreakpointSplitView({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/BreakpointSplitView')),
    })
  })
}
