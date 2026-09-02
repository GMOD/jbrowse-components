import type { LayoutSpecNode } from '../WorkspaceLayout/spec.ts'
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
 * A spec's `layout`: the one layout shape, with a leaf's `views` counting into
 * the spec's own `views` array (an index names every view that entry created)
 * or naming a view id the spec pinned with `id`.
 *
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
export type LayoutNode = LayoutSpecNode
