import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
import type { InitState } from '@jbrowse/plugin-linear-genome-view'
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
  | {
      type: 'hub'
      // a plain string[], not the loader's own `hubURL` MST array: this whole
      // value lives in a `types.frozen` prop, which contractually holds
      // detached JSON. Storing the live node there instead reads as a dead
      // node once the loader is destroyed, and nothing catches it — MST's
      // deepFreeze deliberately skips observable arrays.
      hubSpec: { hubURL: string[] }
      // the loc/assembly/tracks URL shorthand, when the link carried it
      // alongside &hubURL=; applied on top of the hub session
      viewInit?: Partial<InitState>
    }
  | { type: 'default' }
  | { type: 'error'; error: unknown }

export { type SessionMetadata } from '@jbrowse/web-core'
