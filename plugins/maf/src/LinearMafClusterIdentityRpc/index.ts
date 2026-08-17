import LinearMafClusterIdentityMatrix from './LinearMafClusterIdentityMatrix.ts'
import LinearMafGetIdentityMatrix from './LinearMafGetIdentityMatrix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMafClusterIdentityMatrixF(
  pluginManager: PluginManager,
) {
  pluginManager.addRpcMethod(
    () => new LinearMafClusterIdentityMatrix(pluginManager),
  )
  pluginManager.addRpcMethod(
    () => new LinearMafGetIdentityMatrix(pluginManager),
  )
}
