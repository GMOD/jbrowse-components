import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'

import DiagonalizeSyntenyRpc from './DiagonalizeSyntenyRpc.ts'
import LGVSyntenyDisplayF from './LGVSyntenyDisplay/index.ts'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView.ts'
import LinearViewMenuItemsF from './LaunchSyntenyView/linearViewMenuItems.ts'
import LinearReadVsRefMenuItemF from './LinearReadVsRef/index.ts'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay/index.ts'
import { SyntenyGetFeaturesAndPositions } from './LinearSyntenyRPC/SyntenyGetFeaturesAndPositions.ts'
import LinearSyntenyViewF from './LinearSyntenyView/index.ts'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail/index.ts'
import SyntenyTrackF from './SyntenyTrack/index.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { LinearSyntenyImportFormSyntenyOption } from './LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx'
export { renderToSvg } from './LinearSyntenyView/svgcomponents/SVGLinearSyntenyView.tsx'
export type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'
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
    pluginManager.addRpcMethod(
      () => new SyntenyGetFeaturesAndPositions(pluginManager),
    )
    pluginManager.addRpcMethod(() => new DiagonalizeSyntenyRpc(pluginManager))
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }
  }
}
