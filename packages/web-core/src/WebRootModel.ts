import type { Menu } from '@jbrowse/app-core'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { AssemblyManager } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

/** Shape of the jbrowse config model as seen from the session */
export interface JBrowseModelInterface {
  readonly configuration: AnyConfigurationModel
  readonly assemblies: Instance<BaseAssemblyConfigSchema>[]
  readonly connections: BaseConnectionConfigModel[]
  readonly tracks: readonly { trackId: string; [key: string]: unknown }[]
  addAssemblyConf(conf: AnyConfiguration): unknown
  removeAssemblyConf(name: string): void
  addConnectionConf(conf: AnyConfigurationModel): unknown
  deleteConnectionConf(conf: AnyConfigurationModel): unknown
}

/**
 * What BaseWebSession requires from its parent root model.
 * The concrete root model (e.g. jbrowse-web's RootModel) must satisfy this.
 */
export interface WebRootModelInterface {
  readonly jbrowse: JBrowseModelInterface
  readonly rpcManager: RpcManager
  readonly adminMode: boolean
  readonly assemblyManager: AssemblyManager
  readonly textSearchManager: TextSearchManager
  readonly version: string
  readonly savedSessionMetadata: SessionMetadata[] | undefined
  readonly history: {
    canUndo: boolean
    canRedo: boolean
    undo(): void
    redo(): void
  }
  menus(): Menu[]
  setPluginsUpdated(flag: boolean): void
  deleteSavedSession(id: string): Promise<void>
  setSavedSessionFavorite(id: string, favorite: boolean): Promise<void>
  renameCurrentSession(name: string): void
  activateSession(id: string): Promise<void>
  setDefaultSession(): void
  setSession(snapshot: Record<string, unknown>): void
}
