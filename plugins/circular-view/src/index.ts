import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import DataUsageIcon from '@mui/icons-material/DataUsage'

import ChordVariantDisplayF from './ChordVariantDisplay/index.ts'
import CircularViewF from './CircularView/index.ts'
import LaunchCircularViewF from './LaunchCircularView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    CircularViewF(pluginManager)
    LaunchCircularViewF(pluginManager)
    ChordVariantDisplayF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Circular view',
        icon: DataUsageIcon,
        onClick: (session: AbstractViewContainer) => {
          session.addView('CircularView', {})
        },
      })
    }
  }
}

export {
  type CircularViewInit,
  type CircularViewModel,
  type CircularViewStateModel,
  type ExportSvgOptions,
} from './CircularView/model.ts'
export {
  Slice,
  type SliceRegion,
  type SliceElidedRegion,
  type SliceNonElidedRegion,
} from './CircularView/slices.ts'
export { renderToSvg } from './CircularView/svgcomponents/SVGCircularView.tsx'

// Re-exported so the `declare module '@jbrowse/core/PluginManager'` block in
// this module reaches an installed consumer. tsc keeps a module in the emitted
// `.d.ts` only when the entry's public surface names it; a value import used
// inside `install()` is erased, and so was this point's declaration — leaving
// `addToExtensionPoint` on its untyped overload for the external plugin the
// point exists for. `scripts/check-extension-point-reachability.ts` is the gate.
export type { LaunchCircularViewArgs } from './LaunchCircularView/index.ts'
