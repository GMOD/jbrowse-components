import LinearMafGetAnnotationData from './LinearMafGetAnnotationData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMafGetAnnotationDataF(
  pluginManager: PluginManager,
) {
  pluginManager.addRpcMethod(
    () => new LinearMafGetAnnotationData(pluginManager),
  )
}
