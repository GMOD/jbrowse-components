import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@jbrowse/core/util/types'
import TableChartIcon from '@mui/icons-material/TableChart'
import SvInspectorViewTypeFactory from './SvInspectorView/SvInspectorViewType'
import SvInspectorViewModel from './SvInspectorView/models/SvInspectorView'

type SvInspectorView = ReturnType<typeof SvInspectorViewModel>['stateModel']

export default class SvInspectorViewPlugin extends Plugin {
  name = 'SvInspectorViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(SvInspectorViewTypeFactory),
    )

    pluginManager.addToExtensionPoint(
      'LaunchView-SvInspectorView',
      // @ts-ignore
      async ({
        session,
        assembly,
        uri,
        fileType,
      }: {
        session: AbstractSessionModel
        assembly: string
        uri: string
        fileType?: string
      }) => {
        // add view, make typescript happy with return type
        const view = session.addView(
          'SvInspectorView',
        ) as unknown as SvInspectorView

        if (!view) {
          throw new Error('Failed to initialize view')
        }
        const exts = uri.split('.')
        let ext = exts?.pop()?.toUpperCase()
        if (ext === 'GZ') {
          ext = exts?.pop()?.toUpperCase()
        }

        // @ts-ignore
        view.spreadsheetView.importWizard.setFileType(fileType || ext || '')
        // @ts-ignore
        view.spreadsheetView.importWizard.setSelectedAssemblyName(assembly)
        // @ts-ignore
        view.spreadsheetView.importWizard.setFileSource({
          uri,
          locationType: 'UriLocation',
        })
        // @ts-ignore
        view.spreadsheetView.importWizard.import(assembly)
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'SV inspector',
        icon: TableChartIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SvInspectorView', {})
        },
      })
    }
  }
}
