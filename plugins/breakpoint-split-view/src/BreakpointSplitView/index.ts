import { ViewType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { breakpointSplitLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function BreakpointSplitViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    const stateModel = (): Promise<ViewTypeRegistry['BreakpointSplitView']> =>
      import('./model.ts').then(f => f.default(pluginManager))
    return new ViewType({
      name: 'BreakpointSplitView',
      displayName: 'Breakpoint split view',
      stateModel,
      launchKeys: breakpointSplitLaunchKeys,
      ReactComponent: lazyWithPreload(
        () => import('./components/BreakpointSplitView.tsx'),
      ),
    })
  })
}
