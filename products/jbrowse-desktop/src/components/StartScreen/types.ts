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
}

export interface UCSCListGenome {
  name: string
  orderKey: number
  description: string
  scientificName: string
  organism: string
}

export type LaunchCallback = (
  sel: { shortName: string; jbrowseConfig: string }[],
) => void

export interface Fav {
  id: string
  shortName: string
  description: string
  jbrowseConfig: string
  commonName: string
}
