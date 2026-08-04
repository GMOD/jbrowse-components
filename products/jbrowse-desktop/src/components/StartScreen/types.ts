import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'

/**
 * A recent-sessions row as the start screen shows it. Every field the main
 * process stamps on an entry (see RecentSessionInfo) is present; `name` is the
 * one the IPC contract leaves optional, and RecentSessionPanel resolves it
 * before anything renders a row.
 */
export interface RecentSessionData {
  path: string
  name: string
  updated: number
  isAutosave: boolean
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
  defaultSession?: { name?: string } & Record<string, unknown>
  configuration?: Record<string, unknown>
}

/**
 * A config as it arrives — read off disk, fetched from a hub url, or assembled
 * by one of the start screen's launchers. None of the three list fields is
 * guaranteed to be there: createPluginManager is what merges in the defaults
 * and dedupes, and only its result is a {@link JBrowseConfig}.
 */
export type JBrowseConfigInput = Partial<JBrowseConfig>

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
