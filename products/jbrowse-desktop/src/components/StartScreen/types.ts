import type { PluginDefinition } from '@jbrowse/core/PluginLoader'

export interface RecentSessionData {
  path: string
  name: string
  screenshot?: string
  updated?: number
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
}

export type LaunchCallback = (
  sel: { shortName: string; jbrowseConfig: string }[],
) => void

export interface Fav {
  id: string
  shortName: string
  description: string
  jbrowseConfig: string
  jbrowseMinimalConfig?: string
  commonName: string
}
