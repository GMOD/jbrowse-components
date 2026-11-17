import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util/types'
import CallSplitIcon from '@mui/icons-material/CallSplit'

import BreakpointGetFeaturesF from './BreakpointGetFeatures/index.ts'
import BreakpointSplitViewF from './BreakpointSplitView/index.ts'
import LaunchBreakpointSplitViewF from './LaunchBreakpointSplitView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util/types'

// Same export the circular and synteny plugins make, and for the same consumer:
// a headless renderer (`@jbrowse/img`) needs the SVG path without going through
// the model's `exportSvg` action, which downloads a file. The model itself
// reaches this module by lazy import, so nothing here changes what the app
// bundles.
export { renderToSvg } from './BreakpointSplitView/svgcomponents/SVGBreakpointSplitView.tsx'
export type { BreakpointViewModel } from './BreakpointSplitView/model.ts'
export type {
  BreakpointSplitViewInitView,
  LayoutRecord,
} from './BreakpointSplitView/types.ts'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    BreakpointSplitViewF(pluginManager)
    LaunchBreakpointSplitViewF(pluginManager)
    BreakpointGetFeaturesF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Breakpoint split view',
        icon: CallSplitIcon,
        onClick: (session: AbstractViewContainer) => {
          void session.launchView('BreakpointSplitView', {})
        },
      })
    }
  }
}

// Carries this module's extension-point declaration into the emitted `.d.ts`;
// `scripts/check-extension-point-reachability.ts` is the gate, and its header
// is the why.
export type { LaunchBreakpointSplitViewArgs } from './LaunchBreakpointSplitView/index.ts'
