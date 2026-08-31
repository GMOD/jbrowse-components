import type { TrackInit } from '@jbrowse/core/util/tracks'

export interface ViewSpec {
  type: string
  // optional explicit view id so another view in the spec can reference it
  // (e.g. a connected MsaView pointing at this view via connectedViewId)
  id?: string
  // title shown in the view header / workspace tab, instead of the assembly
  // names a view falls back to. Applied by loadSessionSpec for every view type
  // rather than by each launcher, since it is a base view prop.
  displayName?: string
  tracks?: TrackInit[]
  // optional because whether a view type needs one at all is its launcher's
  // business — each reports its own missing-assembly error (naming the view type)
  // rather than being pre-validated into a generic one here
  assembly?: string
  loc?: string
  /**
   * @deprecated v4's nesting. Write every setting directly on the view object;
   * this is unwrapped on the way in and warns.
   */
  init?: Record<string, unknown>
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
  // Container node - arranges children in a direction. 'tabs' stacks them into
  // one tab group rather than splitting the space between them.
  direction?: 'horizontal' | 'vertical' | 'tabs'
  children?: LayoutNode[]
  // Size as percentage (0-100) of the parent container; ignored under 'tabs'
  size?: number
}
