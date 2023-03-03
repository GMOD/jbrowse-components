import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { SpreadsheetViewModel } from '../SpreadsheetView'

export default (pluginManager: PluginManager) => {
  pluginManager.addToExtensionPoint(
    'LaunchView-SpreadsheetView',
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
      const view = session.addView('SpreadsheetView') as SpreadsheetViewModel

      if (!view) {
        throw new Error('Failed to initialize view')
      }
      const exts = uri.split('.')
      let ext = exts?.pop()?.toUpperCase()
      if (ext === 'GZ') {
        ext = exts?.pop()?.toUpperCase()
      }

      view.importWizard.setFileType(fileType || ext || '')
      view.importWizard.setSelectedAssemblyName(assembly)
      view.importWizard.setFileSource({
        uri,
        locationType: 'UriLocation',
      })
      await view.importWizard.import(assembly)
    },
  )
}
