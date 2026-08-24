import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import TimelineIcon from '@mui/icons-material/Timeline'

import DiagonalizeDotplotRpc from './DiagonalizeDotplotRpc.ts'
import { DotplotGetFeaturesAndPositions } from './DotplotDisplay/DotplotGetFeaturesAndPositions.ts'
import DotplotDisplayF from './DotplotDisplay/index.ts'
import DotplotReadVsRefMenuItem from './DotplotReadVsRef/index.ts'
import installDotplotHighlights from './DotplotView/components/installDotplotHighlights.tsx'
import DotplotViewF from './DotplotView/index.ts'
import LaunchDotplotViewF from './LaunchDotplotView.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

export type { DotplotImportFormSyntenyOption } from './DotplotView/components/ImportForm/TrackSelector.tsx'
export { default as DotplotHighlightBands } from './DotplotView/components/DotplotHighlightBands.tsx'
export { renderToSvg } from './DotplotView/svgcomponents/SVGDotplotView.tsx'
export type {
  DotplotViewModel,
  DotplotViewStateModel,
} from './DotplotView/model.ts'
// The view's `init` snapshot contract, so a programmatic caller (jbrowse-img, an
// embedded host) builds it against the same type the init autorun reads.
export type { DotplotViewInit } from './DotplotView/types.ts'

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    DotplotViewF(pluginManager)
    DotplotDisplayF(pluginManager)
    LaunchDotplotViewF(pluginManager)
    DotplotReadVsRefMenuItem(pluginManager)
    installDotplotHighlights(pluginManager)

    pluginManager.addRpcMethod(() => new DiagonalizeDotplotRpc(pluginManager))
    pluginManager.addRpcMethod(
      () => new DotplotGetFeaturesAndPositions(pluginManager),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Dotplot view',
        icon: TimelineIcon,
        onClick: (session: AbstractViewContainer) => {
          session.addView('DotplotView', {})
        },
      })
    }
  }
}

// Re-exported so the `declare module '@jbrowse/core/PluginManager'` block in
// this module reaches an installed consumer. tsc keeps a module in the emitted
// `.d.ts` only when the entry's public surface names it; a value import used
// inside `install()` is erased, and so was this point's declaration — leaving
// `addToExtensionPoint` on its untyped overload for the external plugin the
// point exists for. `scripts/check-extension-point-reachability.ts` is the gate.
export type { LaunchDotplotViewArgs } from './LaunchDotplotView.ts'
