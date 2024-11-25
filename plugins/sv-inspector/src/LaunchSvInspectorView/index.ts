import type { SvInspectorViewModel } from '../SvInspectorView/models/SvInspectorView'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchSvInspectorViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-SvInspectorView',
    // @ts-expect-error
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
      const view = session.addView('SvInspectorView') as SvInspectorViewModel
      const exts = uri.split('.')
      let ext = exts.pop()?.toUpperCase()
      if (ext === 'GZ') {
        ext = exts.pop()?.toUpperCase()
      }

      view.spreadsheetView.importWizard.setFileType(fileType || ext || '')
      view.spreadsheetView.importWizard.setSelectedAssemblyName(assembly)
      view.spreadsheetView.importWizard.setFileSource({
        uri,
        locationType: 'UriLocation',
      })
      await view.spreadsheetView.importWizard.import(assembly)
    },
  )
}
