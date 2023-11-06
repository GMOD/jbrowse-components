import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { SvInspectorViewModel } from '../SvInspectorView/models/SvInspectorView'

export default function LaunchSvInspectorViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-SvInspectorView',
    // @ts-expect-error
    async ({
      session,
      assembly,
      uri,
    }: {
      session: AbstractSessionModel
      assembly: string
      uri: string
    }) => {
      const view = session.addView('SvInspectorView') as SvInspectorViewModel
      view.spreadsheetView.importWizard.setSelectedAssemblyName(assembly)
      view.spreadsheetView.importWizard.setSpreadsheetFilehandle({
        uri,
        locationType: 'UriLocation',
      })
    },
  )
}
