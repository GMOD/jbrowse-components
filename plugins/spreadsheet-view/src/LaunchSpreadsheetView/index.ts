import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { SpreadsheetViewModel } from '../SpreadsheetView'

export default function LaunchSpreadsheetViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-SpreadsheetView',
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
      const view = session.addView('SpreadsheetView') as SpreadsheetViewModel
      view.importWizard.setSelectedAssemblyName(assembly)
      view.importWizard.setSpreadsheetFilehandle({
        uri,
        locationType: 'UriLocation',
      })
    },
  )
}
