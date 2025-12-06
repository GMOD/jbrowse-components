import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Instance } from '@jbrowse/mobx-state-tree'

type AssemblyManager = Instance<ReturnType<typeof assemblyManagerFactory>>

/**
 * Base interface for root model properties that sessions expect to exist
 */
export interface BaseRootModelType {
  jbrowse: {
    assemblies: AnyConfigurationModel[]
    configuration: AnyConfigurationModel
  }
  session: unknown
  assemblyManager: AssemblyManager
  rpcManager: RpcManager
  adminMode: boolean
  textSearchManager: TextSearchManager
}
