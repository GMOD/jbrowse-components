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

/**
 * Nested layout structure for workspaces.
 *
 * A LayoutNode is either:
 * - A panel (has `views` array) - displays views stacked vertically
 * - A container (has `children` array) - arranges children horizontally or vertically
 *
 * Example - horizontal split:
 * ```json
 * {
 *   "direction": "horizontal",
 *   "children": [
 *     { "views": [0, 1] },
 *     { "views": [2] }
 *   ]
 * }
 * ```
 *
 * Example - complex nested layout:
 * ```json
 * {
 *   "direction": "horizontal",
 *   "children": [
 *     { "views": [0, 1] },
 *     {
 *       "direction": "vertical",
 *       "children": [
 *         { "views": [2] },
 *         { "views": [3] }
 *       ]
 *     }
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
}

export interface SessionTriagedInfo {
  snap: unknown
  origin: string
  reason: PluginDefinition[]
}
