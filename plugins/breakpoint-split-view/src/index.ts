import Plugin from '@jbrowse/core/Plugin'

import BreakpointAlignmentsWidgetF from './BreakpointAlignmentsFeatureDetail/index.ts'
import BreakpointGetFeaturesF from './BreakpointGetFeatures/index.ts'
import BreakpointSplitViewF from './BreakpointSplitView/index.ts'
import LaunchBreakpointSplitViewF from './LaunchBreakpointSplitView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Same export the circular and synteny plugins make, and for the same consumer:
// a headless renderer (`@jbrowse/img`) needs the SVG path without going through
// the model's `exportSvg` action, which downloads a file. The model itself
// reaches this module by lazy import, so nothing here changes what the app
// bundles.
export { renderToSvg } from './BreakpointSplitView/svgcomponents/SVGBreakpointSplitView.tsx'
export type {
  BreakpointViewModel,
  BreakpointViewStateModel,
} from './BreakpointSplitView/model.ts'
export type {
  BreakpointSplitViewInitView,
  LayoutMatch,
  LayoutRecord,
  OverlayLevel,
  OverlayMatch,
} from './BreakpointSplitView/types.ts'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    BreakpointSplitViewF(pluginManager)
    BreakpointAlignmentsWidgetF(pluginManager)
    LaunchBreakpointSplitViewF(pluginManager)
    BreakpointGetFeaturesF(pluginManager)
  }

  configure() {}
}

// Re-exported so the `declare module '@jbrowse/core/PluginManager'` block in
// this module reaches an installed consumer. tsc keeps a module in the emitted
// `.d.ts` only when the entry's public surface names it; a value import used
// inside `install()` is erased, and so was this point's declaration — leaving
// `addToExtensionPoint` on its untyped overload for the external plugin the
// point exists for. `scripts/check-extension-point-reachability.ts` is the gate.
export type { LaunchBreakpointSplitViewArgs } from './LaunchBreakpointSplitView/index.ts'
