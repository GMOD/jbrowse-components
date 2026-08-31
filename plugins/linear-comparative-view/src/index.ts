import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'

import DiagonalizeSyntenyRpc from './DiagonalizeSyntenyRpc.ts'
import LGVSyntenyDisplayF from './LGVSyntenyDisplay/index.ts'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView.ts'
import { SyntenyDiscoverMates } from './LaunchSyntenyView/SyntenyDiscoverMatesRpc.ts'
import LinearViewMenuItemsF from './LaunchSyntenyView/linearViewMenuItems.ts'
import LinearDerivativeVsRefMenuItemF from './LinearDerivativeVsRef/index.ts'
import LinearReadVsRefMenuItemF from './LinearReadVsRef/index.ts'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay/index.ts'
import SyntenyGetCigarMap from './LinearSyntenyRPC/SyntenyGetCigarMap.ts'
import { SyntenyGetFeaturesAndPositions } from './LinearSyntenyRPC/SyntenyGetFeaturesAndPositions.ts'
import SyntenyResolveMatchingRegion from './LinearSyntenyRPC/SyntenyResolveMatchingRegion.ts'
import LinearSyntenyViewF from './LinearSyntenyView/index.ts'
import MultiWaySyntenyDisplayF from './MultiWaySyntenyDisplay/index.ts'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail/index.ts'
import SyntenyTrackF from './SyntenyTrack/index.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util'

export type { LinearSyntenyImportFormSyntenyOption } from './LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx'
export { renderToSvg } from './LinearSyntenyView/svgcomponents/SVGLinearSyntenyView.tsx'
export type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'
export type { MultiWaySyntenyDisplayModel } from './MultiWaySyntenyDisplay/model.ts'
// The ribbon layer for one band, and the model it takes. A host drawing its own
// comparative chrome needs this: the two genome rows are ordinary LGVs it
// already knows how to mount, and the per-display `RenderingComponent` (tooltip,
// context menu, fetch status) comes off the display model — but the ribbons are
// drawn here, over `useRenderingBackend` and `SyntenyRendererFactory`, and there
// is no way to write a substitute that isn't a worse copy of the GPU path. Same
// argument as `usePanZoom`: an embedder would *have to* rebuild it, so it is a
// missing export rather than something the reader owns.
export { default as LevelSyntenyCanvas } from './LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'
// A level, for a host that reaches one off `view.levels` and wants to name what
// it holds — its `linearSyntenyDisplays` and the `RenderingComponent` on each.
// `levels[i]` carries this type on its own now that the view/level/display cycle
// is cut at the display's `view` getter (`parentViewDuck.ts`), so this is a
// convenience rather than the antidote it used to be.
export type { LinearSyntenyViewHelperModel } from './LinearSyntenyViewHelper/stateModelFactory.ts'
// The view object a programmatic caller (jbrowse-img, an embedded host) writes,
// derived from the state model rather than hand-copied.
export type {
  CigarMode,
  FadeThinMode,
  LinearSyntenyViewInit,
  LinearSyntenyViewSpec,
} from './LinearSyntenyView/types.ts'

export default class LinearComparativeViewPlugin extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    LinearSyntenyViewF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)
    LGVSyntenyDisplayF(pluginManager)
    MultiWaySyntenyDisplayF(pluginManager)
    LaunchLinearSyntenyViewF(pluginManager)
    LinearViewMenuItemsF(pluginManager)
    SyntenyTrackF(pluginManager)
    LinearReadVsRefMenuItemF(pluginManager)
    LinearDerivativeVsRefMenuItemF(pluginManager)
    pluginManager.addRpcMethod(
      () => new SyntenyGetFeaturesAndPositions(pluginManager),
    )
    pluginManager.addRpcMethod(() => new DiagonalizeSyntenyRpc(pluginManager))
    pluginManager.addRpcMethod(() => new SyntenyDiscoverMates(pluginManager))
    pluginManager.addRpcMethod(() => new SyntenyGetCigarMap(pluginManager))
    pluginManager.addRpcMethod(
      () => new SyntenyResolveMatchingRegion(pluginManager),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractViewContainer) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }
  }
}

// Carries this module's extension-point declaration into the emitted `.d.ts`;
// `scripts/check-extension-point-reachability.ts` is the gate, and its header
// is the why.
export type { LaunchLinearSyntenyViewArgs } from './LaunchLinearSyntenyView.ts'
