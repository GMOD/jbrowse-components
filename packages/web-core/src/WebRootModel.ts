import type { AppRootModel } from '@jbrowse/app-core'
import type TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import type { BaseAssemblyConfigModel } from '@jbrowse/core/assemblyManager'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type RpcManager from '@jbrowse/core/rpc/RpcManager'

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
  readonly assemblies: BaseAssemblyConfigModel[]
  readonly connections: BaseConnectionConfigModel[]
  readonly tracks: readonly { trackId: string; [key: string]: unknown }[]
  addAssemblyConf(conf: AnyConfiguration): unknown
  removeAssemblyConf(name: string): void
  addConnectionConf(conf: AnyConfigurationModel): unknown
  deleteConnectionConf(conf: AnyConfigurationModel): unknown
}

/**
 * What BaseWebSession requires from its parent root model: the shared
 * {@link AppRootModel} surface plus the web-only session-management members.
 * The concrete root model (e.g. jbrowse-web's RootModel) must satisfy this.
 */
export interface WebRootModelInterface extends AppRootModel {
  readonly jbrowse: JBrowseModelInterface
  readonly rpcManager: RpcManager
  readonly adminMode: boolean
  readonly textSearchManager: TextSearchManager
  readonly savedSessionMetadata: SessionMetadata[] | undefined
  setPluginsUpdated(): void
  deleteSavedSession(id: string): Promise<void>
  setSavedSessionFavorite(id: string, favorite: boolean): Promise<void>
  renameSavedSession(id: string, name: string): Promise<void>
  activateSession(id: string): Promise<void>
  setDefaultSession(): void
  setSession(snapshot: Record<string, unknown>): void
}
