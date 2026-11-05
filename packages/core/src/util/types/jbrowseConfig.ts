import type { BaseAssemblyConfigModel } from '../../assemblyManager/assemblyConfigSchema.ts'
import type {
  AnyConfiguration,
  AnyConfigurationModel,
  ConfigModelForFields,
  TrackConfigEntry,
} from '../../configuration/index.ts'
import type { BaseConnectionConfigModel } from '../../pluggableElementTypes/models/baseConnectionConfig.ts'
import type { PluginDefinition } from '../../pluginDefinitions.ts'
import type RpcManager from '../../rpc/RpcManager.ts'
import type { RpcConfigModel } from '../../rpc/configSchema.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The loaded config every product's root holds as `jbrowse`, and its session
 * reads as `session.jbrowse`.
 */
export interface JBrowseConfigModel extends IStateTreeNode {
  configuration: AnyConfigurationModel
  rpcManager: RpcManager
  assemblies: BaseAssemblyConfigModel[]
  assemblyNames: string[]
  tracks: TrackConfigEntry[]
  connections: BaseConnectionConfigModel[]
  internetAccounts: AnyConfigurationModel[]
  aggregateTextSearchAdapters: AnyConfigurationModel[]
  addConnectionConf(conf: AnyConfiguration): BaseConnectionConfigModel
  deleteConnectionConf(conf: AnyConfigurationModel): boolean
}

// also what resolveShareUrl falls back to, reading a raw config snapshot
export const DEFAULT_SHARE_URL = 'https://share.jbrowse.org/api/v1/'

/**
 * The root config slots core reads that only jbrowse-web, desktop and
 * react-app declare, spread into their `RootConfiguration`.
 */
export const appRootConfigSchemaFields = {
  shareURL: {
    type: 'string',
    defaultValue: DEFAULT_SHARE_URL,
    description:
      'URL of the session-sharing backend used by the Share button, a JBrowse-hosted service by default',
    advanced: true,
  },
  disableAnalytics: {
    type: 'boolean',
    defaultValue: false,
    description: 'disables collection of anonymous usage analytics',
    advanced: true,
  },
  logoPath: {
    type: 'maybeFileLocation',
    description:
      'a custom logo image displayed in the app header; unset, the JBrowse logo',
    advanced: true,
  },
} as const

export type AppRootConfigModel = ConfigModelForFields<
  typeof appRootConfigSchemaFields
>

/**
 * The config of jbrowse-web, desktop and react-app, which a session edits in
 * place. The embedded products' config holds no editing actions beyond
 * connections.
 */
export interface EditableJBrowseConfigModel extends JBrowseConfigModel {
  configuration: AppRootConfigModel & { rpc: RpcConfigModel }
  plugins: PluginDefinition[]
  defaultSession: { name: string; [key: string]: unknown }
  preConfiguredSessions: { name: string; [key: string]: unknown }[]
  addTrackConf(conf: AnyConfiguration): TrackConfigEntry | undefined
  updateTrackConf(conf: { trackId: string; [key: string]: unknown }): void
  deleteTrackConf(conf: AnyConfigurationModel | { trackId: string }): void
  addAssemblyConf(conf: AnyConfiguration): BaseAssemblyConfigModel
  removeAssemblyConf(assemblyName: string): void
  addPlugin(pluginDefinition: PluginDefinition): void
  removePlugin(pluginDefinition: PluginDefinition): void
  setDefaultSessionConf(
    sessionConf: IStateTreeNode | { name: string; [key: string]: unknown },
  ): void
  addInternetAccountConf(conf: AnyConfigurationModel): AnyConfigurationModel
  deleteInternetAccountConf(conf: AnyConfigurationModel): boolean
}

export function isEditableJBrowseConfig(
  config: JBrowseConfigModel,
): config is EditableJBrowseConfigModel {
  return 'addTrackConf' in config && 'updateTrackConf' in config
}

/**
 * A session's config as the editable one, for an action that writes to it; an
 * embedded product's config throws here rather than at a missing method.
 */
export function editableConfig(session: {
  jbrowse: JBrowseConfigModel
}): EditableJBrowseConfigModel {
  const { jbrowse } = session
  if (!isEditableJBrowseConfig(jbrowse)) {
    throw new Error("this product's config cannot be edited")
  }
  return jbrowse
}
