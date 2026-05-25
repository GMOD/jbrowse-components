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
      session.addView('SpreadsheetView', {
        init: {
          assembly,
          uri,
          fileType,
        },
      })
    },
  )
}
