import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@jbrowse/core/util/types'
import TableChartIcon from '@material-ui/icons/TableChart'
import SvInspectorViewTypeFactory from './SvInspectorView/SvInspectorViewType'

type SvInspectorView = ReturnType<typeof SvInspectorViewTypeFactory>

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
        const { rootModel } = pluginManager
        const view = rootModel?.session?.addView(
          'SvInspectorView',
        ) as SvInspectorView

        if (!view) {
          throw new Error('Failed to initialize view')
        }
        const exts = uri.split('.')
        let ext = exts?.pop()?.toUpperCase()
        if (ext === 'GZ') {
          ext = exts?.pop()?.toUpperCase()
        }

        view.spreadsheetView.importWizard.setFileType(fileType || ext || '')
        view.spreadsheetView.importWizard.setSelectedAssemblyName(assembly)
        view.spreadsheetView.importWizard.setFileSource({
          uri,
          locationType: 'UriLocation',
        })
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
