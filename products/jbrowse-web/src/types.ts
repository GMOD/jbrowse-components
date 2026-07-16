import type { PluginDefinition } from '@jbrowse/core/PluginLoader'
import type { SessionMetadata } from '@jbrowse/web-core'
import type { DBSchema } from 'idb'

// JSON-shaped snapshot used for configs and session payloads as they cross the
// URL / IDB / network / MST boundaries.
export type Snap = Record<string, unknown>

export interface Session {
  name: string
  id: string
  [key: string]: unknown
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

// The session-spec shapes (ViewSpec/LayoutNode/TrackInit) live in
// @jbrowse/app-core alongside loadSessionSpec, so Desktop shares one definition
// of the spec format with Web.
export type { LayoutNode, TrackInit, ViewSpec } from '@jbrowse/app-core'

export interface SessionTriagedInfo {
  snap: Record<string, unknown>
  origin: 'session' | 'config'
  reason: PluginDefinition[]
}

/**
 * The single resolved session the loader hands to createPluginManager. The
 * loader's job is to turn whatever the URL/HMR/storage provided into exactly
 * one of these variants; initSession then applies it. One discriminated value
 * replaces the former scattered sessionSnapshot/sessionSpec/hubSpec/
 * blankSession/sessionError flags.
 */
export type SessionSource =
  | { type: 'snapshot'; snapshot: Snap }
  | { type: 'spec'; spec: Snap }
  | { type: 'hub'; hubSpec: Snap }
  | { type: 'default' }
  | { type: 'error'; error: unknown }

export { type SessionMetadata } from '@jbrowse/web-core'
