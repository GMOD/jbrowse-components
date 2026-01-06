import type { SpreadsheetViewModel } from '../SpreadsheetView/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default function LaunchSpreadsheetViewF(pluginManager: PluginManager) {
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
      // Use the init property to let the model handle initialization
      session.addView('SpreadsheetView', {
        init: {
          assembly,
          uri,
          fileType,
        },
      }) as SpreadsheetViewModel
    },
  )
}
