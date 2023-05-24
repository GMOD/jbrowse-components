import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import BreakpointSplitView from './BreakpointSplitView'
import stateModelFactory from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addViewType(() => {
    return new BreakpointSplitView({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: lazy(() => import('./components/BreakpointSplitView')),
    })
  })
}
