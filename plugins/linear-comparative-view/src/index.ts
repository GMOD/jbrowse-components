import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import { multiPairTypes } from '@jbrowse/plugin-comparative-adapters'
import CalendarIcon from '@mui/icons-material/CalendarViewDay'

import LGVSyntenyDisplayF from './LGVSyntenyDisplay/index.ts'
import MultiLGVSyntenyDisplayF from './MultiLGVSyntenyDisplay/index.ts'
import LaunchLinearSyntenyViewF from './LaunchLinearSyntenyView.ts'
import LinearComparativeViewF from './LinearComparativeView/index.ts'
import LinearReadVsRefMenuItemF from './LinearReadVsRef/index.ts'
import LinearSyntenyDisplayF from './LinearSyntenyDisplay/index.ts'
import { MultiPairGetFeatures } from './LinearSyntenyRPC/MultiPairGetFeatures.ts'
import { SyntenyGetFeaturesAndPositions } from './LinearSyntenyRPC/SyntenyGetFeaturesAndPositions.ts'
import LinearSyntenyViewF from './LinearSyntenyView/index.ts'
import LinearSyntenyViewHelperF from './LinearSyntenyViewHelper/index.tsx'
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
    LinearReadVsRefMenuItemF(pluginManager)
    pluginManager.addRpcMethod(
      () => new SyntenyGetFeaturesAndPositions(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiPairGetFeatures(pluginManager),
    )
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

    pluginManager.addToExtensionPoint(
      'Core-preProcessTrackConfig',
      (snap: Record<string, unknown>) => {
        const adapter = snap.adapter as { type?: string } | undefined
        if (
          snap.type === 'SyntenyTrack' &&
          adapter &&
          multiPairTypes.includes(adapter.type ?? '')
        ) {
          const displays = snap.displays as { type: string }[] | undefined
          if (displays) {
            const multiIdx = displays.findIndex(
              d => d.type === 'MultiLGVSyntenyDisplay',
            )
            const lgvIdx = displays.findIndex(
              d => d.type === 'LGVSyntenyDisplay',
            )
            if (multiIdx > lgvIdx && lgvIdx >= 0) {
              const [multi] = displays.splice(multiIdx, 1)
              displays.splice(lgvIdx, 0, multi!)
            }
          }
        }
        return snap
      },
    )
  }
}
