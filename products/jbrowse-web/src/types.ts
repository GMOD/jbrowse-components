import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type { DBSchema } from 'idb'

export interface Session {
  name: string
  id: string
  [key: string]: unknown
}

export interface SessionMetadata {
  id: string
  name: string
  createdAt: Date
  configPath: string
  favorite: boolean
}

export interface SessionDB extends DBSchema {
  sessions: {
    key: string
    value: Session
  }
  metadata: {
    key: string
    value: SessionMetadata
  }
}

export interface ViewSpec {
  type: string
  tracks?: string[]
  assembly: string
  loc: string
}

export interface SessionTriagedInfo {
  snap: unknown
  origin: string
  reason: PluginDefinition[]
}
