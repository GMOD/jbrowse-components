import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { SnapshotIn } from 'mobx-state-tree'
interface TextSearchAdapterConfig {
  textSearchAdapterId: string
  [key: string]: unknown
}
interface InternetAccountConfig {
  internetAccountId: string
  [key: string]: unknown
}
interface TrackConfig {
  trackId: string
  [key: string]: unknown
}
interface SessionSnapshot {
  name: string
  [key: string]: unknown
}
export interface Config {
  assemblies: SnapshotIn<BaseAssemblyConfigSchema>[]
  tracks: TrackConfig[]
  internetAccounts?: InternetAccountConfig[]
  aggregateTextSearchAdapters?: TextSearchAdapterConfig[]
  configuration?: Record<string, unknown>
  defaultSession?: SessionSnapshot
}
