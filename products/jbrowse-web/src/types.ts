import type { SessionMetadata, SessionSpec } from '@jbrowse/app-core'
import type { PluginDefinition } from '@jbrowse/core/pluginDefinitions'
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

// The session-spec shapes (ViewSpec/LayoutNode) live in @jbrowse/app-core
// alongside loadSessionSpec, so Desktop shares one definition of the spec
// format with Web. `TrackInit` is not one of them — it belongs to
// @jbrowse/core/util/tracks, next to the `normalizeTrackInit` that interprets
// it, and consumers import it from there.
export type { LayoutNode, ViewSpec } from '@jbrowse/app-core'

export interface SessionSnap {
  id: string
  sessionPlugins?: PluginDefinition[]
  [key: string]: unknown
}

export type SessionTriagedInfo =
  | { origin: 'session'; snap: SessionSnap; reason: PluginDefinition[] }
  | { origin: 'config'; snap: Snap; reason: PluginDefinition[] }

/**
 * The single resolved session the loader hands to createPluginManager. The
 * loader's job is to turn whatever the URL/HMR/storage provided into exactly
 * one of these variants; initSession then applies it. One discriminated value
 * replaces the former scattered sessionSnapshot/sessionSpec/hubSpec/
 * blankSession/sessionError flags. A `&hubURL=` link is a spec too.
 */
export type SessionSource =
  | { type: 'snapshot'; snapshot: Snap }
  | {
      type: 'spec'
      spec: SessionSpec
      // what the link asked for that the spec cannot carry, shown on the
      // session it opens (see hubLinkSpec)
      notice?: string
    }
  | { type: 'default' }
  | { type: 'error'; error: unknown }

export { type SessionMetadata } from '@jbrowse/app-core'
