import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'

import LGVSyntenyDisplayF from './LGVSyntenyDisplay/index.ts'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView.ts'
import LinearComparativeViewF from './LinearComparativeView/index.ts'
import LinearReadVsRefMenuItemF from './LinearReadVsRef/index.ts'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay/index.ts'
import { GetSubgraph } from './LinearSyntenyRPC/GetSubgraph.ts'
import { MultiPairGetFeatures } from './LinearSyntenyRPC/MultiPairGetFeatures.ts'
import { SyntenyGetFeaturesAndPositions } from './LinearSyntenyRPC/SyntenyGetFeaturesAndPositions.ts'
import LinearSyntenyViewF from './LinearSyntenyView/index.ts'
import LinearSyntenyViewHelperF from './LinearSyntenyViewHelper/index.tsx'
import MultiLGVSyntenyDisplayF from './MultiLGVSyntenyDisplay/index.ts'
import MultiSyntenyTrackF from './MultiSyntenyTrack/index.ts'
import SyntenyFeatureWidgetF from './SyntenyFeatureDetail/index.ts'
import SyntenyTrackF from './SyntenyTrack/index.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { LinearSyntenyImportFormSyntenyOption } from './LinearSyntenyView/components/ImportForm/ImportSyntenyTrackSelectorArea.tsx'
export type { LinearSyntenyViewModel } from './LinearSyntenyView/model.ts'

export default class LinearComparativeViewPlugin extends Plugin {
  name = 'LinearComparativeViewPlugin'

  install(pluginManager: PluginManager) {
    LinearSyntenyViewHelperF(pluginManager)
    LinearComparativeViewF(pluginManager)
    LinearSyntenyViewF(pluginManager)
    LinearSyntenyDisplayF(pluginManager)
    SyntenyFeatureWidgetF(pluginManager)
    LGVSyntenyDisplayF(pluginManager)
    MultiLGVSyntenyDisplayF(pluginManager)
    LaunchLinearSyntenyViewF(pluginManager)
    SyntenyTrackF(pluginManager)
    MultiSyntenyTrackF(pluginManager)
    LinearReadVsRefMenuItemF(pluginManager)
    pluginManager.addRpcMethod(
      () => new SyntenyGetFeaturesAndPositions(pluginManager),
    )
    pluginManager.addRpcMethod(() => new MultiPairGetFeatures(pluginManager))
    pluginManager.addRpcMethod(() => new GetSubgraph(pluginManager))
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

    // Make SyntenyTrack displays also available on MultiSyntenyTrack so that
    // launching N-way synteny views or dotplots from a MultiSyntenyTrack works
    const multiTrack = pluginManager.getTrackType('MultiSyntenyTrack')
    if (multiTrack) {
      for (const displayName of [
        'LinearSyntenyDisplay',
        'DotplotDisplay',
        'LGVSyntenyDisplay',
      ]) {
        const display = pluginManager.getDisplayType(displayName)
        if (display && !multiTrack.displayTypes.includes(display)) {
          multiTrack.addDisplayType(display)
        }
      }
    }
  }
}
