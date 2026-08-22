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
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail/index.ts'
import SyntenyTrackF from './SyntenyTrack/index.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { LinearSyntenyImportFormSyntenyOption } from './LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx'
export { renderToSvg } from './LinearSyntenyView/svgcomponents/SVGLinearSyntenyView.tsx'
export type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'
// The ribbon layer for one band, and the model it takes. A host drawing its own
// comparative chrome needs this: the two genome rows are ordinary LGVs it
// already knows how to mount, and the per-display `RenderingComponent` (tooltip,
// context menu, fetch status) comes off the display model — but the ribbons are
// drawn here, over `useRenderingBackend` and `SyntenyRendererFactory`, and there
// is no way to write a substitute that isn't a worse copy of the GPU path. Same
// argument as `usePanZoom`: an embedder would *have to* rebuild it, so it is a
// missing export rather than something the reader owns.
export { default as LevelSyntenyCanvas } from './LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'
// `levels[i]` is declared `IAnyModelType` to break a type cycle (see
// LinearComparativeView's model), so a host that reaches a level off the view
// holds `any` and everything it reads from one — `linearSyntenyDisplays` and
// the `RenderingComponent` on each — is `any` too, silently. Naming this on the
// value is what gets those back, and it is what JBrowse's own comparative
// render area does with it.
export type { LinearSyntenyViewHelperModel } from './LinearSyntenyViewHelper/stateModelFactory.ts'
// The view's `init` snapshot contract, so a programmatic caller (jbrowse-img,
// an embedded host) builds it against the same type applyInitSettings reads
// rather than a hand-copied shape.
export type {
  CigarMode,
  FadeThinMode,
  LinearSyntenyViewInit,
} from './LinearSyntenyView/types.ts'

export default class LinearComparativeViewPlugin extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    LinearSyntenyViewF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)
    LGVSyntenyDisplayF(pluginManager)
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
        onClick: (session: AbstractSessionModel) => {
          void session.launchView('LinearSyntenyView', {})
        },
      })
    }
  }
}
