import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'

import DiagonalizeSyntenyRpc from './DiagonalizeSyntenyRpc.ts'
import LGVSyntenyDisplayF from './LGVSyntenyDisplay/index.ts'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView.ts'
import LinearReadVsRefMenuItemF from './LinearReadVsRef/index.ts'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay/index.ts'
import { SyntenyGetFeaturesAndPositions } from './LinearSyntenyRPC/SyntenyGetFeaturesAndPositions.ts'
import LinearSyntenyViewF from './LinearSyntenyView/index.ts'
import LinearSyntenyViewHelperF from './LinearSyntenyViewHelper/index.tsx'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail/index.ts'
import SyntenyTrackF from './SyntenyTrack/index.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { LinearSyntenyImportFormSyntenyOption } from './LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx'
export { renderToSvg } from './LinearSyntenyView/svgcomponents/SVGLinearSyntenyView.tsx'
export type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'

export default class LinearComparativeViewPlugin extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    LinearSyntenyViewHelperF(pluginManager)
    LinearSyntenyViewF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)
    LGVSyntenyDisplayF(pluginManager)
    LaunchLinearSyntenyViewF(pluginManager)
    SyntenyTrackF(pluginManager)
    LinearReadVsRefMenuItemF(pluginManager)
    pluginManager.addRpcMethod(
      () => new SyntenyGetFeaturesAndPositions(pluginManager),
    )
    pluginManager.addRpcMethod(() => new DiagonalizeSyntenyRpc(pluginManager))
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Linear synteny view',
        icon: CalendarIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('LinearSyntenyView', {})
        },
      })
    }
  }
}
