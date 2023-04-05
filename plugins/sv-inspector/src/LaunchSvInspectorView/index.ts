import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { SvInspectorViewModel } from '../SvInspectorView/models/SvInspectorView'

export default (pluginManager: PluginManager) => {
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
      // add view, make typescript happy with return type
      const view = session.addView('SvInspectorView') as SvInspectorViewModel

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
      await view.spreadsheetView.importWizard.import(assembly)
    },
  )
}
