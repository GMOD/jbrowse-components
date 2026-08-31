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
export { circularLaunchKeys } from './CircularView/launchKeys.ts'
export { renderToSvg } from './CircularView/svgcomponents/SVGCircularView.tsx'
export type { CircularViewCommands } from './CircularView/types.ts'

// Carries this module's extension-point declaration into the emitted `.d.ts`;
// `scripts/check-extension-point-reachability.ts` is the gate, and its header
// is the why.
export type { LaunchCircularViewArgs } from './LaunchCircularView/index.ts'
