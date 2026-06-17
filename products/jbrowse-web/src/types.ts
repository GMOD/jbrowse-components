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

/**
 * Track initialization can be a simple trackId string or an object with
 * additional configuration for display type and initial state.
 */
export type TrackInit =
  | string
  | {
      trackId: string
      displaySnapshot?: Record<string, unknown>
      trackSnapshot?: Record<string, unknown>
    }

export interface ViewSpec {
  type: string
  tracks?: TrackInit[]
  assembly: string
  loc?: string
}

/**
 * Nested layout structure for workspaces.
 *
 * A LayoutNode is either:
 * - A panel (has `views` array) - displays views stacked vertically
 * - A container (has `children` array) - arranges children horizontally or vertically
 *
 * Example - horizontal split with custom sizes:
 * ```json
 * {
 *   "direction": "horizontal",
 *   "children": [
 *     { "views": [0, 1], "size": 70 },
 *     { "views": [2], "size": 30 }
 *   ]
 * }
 * ```
 */
export interface LayoutNode {
  // Panel node - contains views stacked vertically
  views?: number[]
  // Container node - arranges children in a direction
  direction?: 'horizontal' | 'vertical'
  children?: LayoutNode[]
  // Size as percentage (0-100) of the parent container
  size?: number
}

export interface SessionTriagedInfo {
  snap: Record<string, unknown>
  origin: string
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
