import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

export interface RecentSessionData {
  path: string
  name: string
  updated?: number
  isAutosave?: boolean
}

export interface InternetAccount {
  name: string
  description: string
  clientId: string
  internetAccountId: string
  type: string
}
export interface JBrowseConfig {
  internetAccounts: InternetAccount[]
  assemblies: { name: string }[]
  tracks: { trackId: string }[]
  plugins?: PluginDefinition[]
  defaultSession?: Record<string, unknown>
  configuration?: Record<string, unknown>
}

/**
 * Open a session from one or more remote config urls, merged in order. The
 * launchers only ever fetch these urls — a per-entry display name was carried
 * alongside for a while and never read.
 */
export type LaunchCallback = (configUrls: string[]) => void

export interface Fav {
  id: string
  shortName: string
  description: string
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  commonName: string
}
