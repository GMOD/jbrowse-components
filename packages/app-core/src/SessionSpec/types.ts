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
  // optional explicit view id so another view in the spec can reference it
  // (e.g. a connected MsaView pointing at this view via connectedViewId)
  id?: string
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
