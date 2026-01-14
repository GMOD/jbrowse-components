import type { SvInspectorViewModel } from '../SvInspectorView/model.ts'
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
      // Use the init property to let the model handle initialization
      session.addView('SvInspectorView', {
        init: {
          assembly,
          uri,
          fileType,
        },
      }) as SvInspectorViewModel
    },
  )
}
