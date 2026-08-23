import { addDisposer } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The owner of a stored hover over a shared canvas: the model whose one action
 * fans a pick hit out across every display drawing on that surface. Duck-typed
 * — the concrete owners (a synteny level, the dotplot view) are built by
 * factories downstream of this package.
 */
interface SurfaceHoverHost extends IStateTreeNode {
  /** The owner's fan-out action; `undefined` clears every display under it. */
  setHoveredFeature: (hit: undefined) => void
}

/**
 * Drop a shared surface's stored hover whenever the content moves under a
 * stationary cursor.
 *
 * A stored hover is only as good as its invalidation, and the pointer handlers
 * answer one axis of it: the pointer moving. The other axis is the content
 * moving instead, which fires no pointer event at all — a wheel zoom, a drag
 * pan, a locstring navigation, a plot resize. Left uncleared, the hover goes on
 * naming the feature the cursor *used* to be over, which is exactly what the
 * tooltip renders and the highlight outlines.
 *
 * `transform` is the one value carrying every number that moves the picture —
 * synteny's `bandTransformKey`, dotplot's `plotTransform`. Watching that value
 * instead of listing entry points is the design: the wheel was the entry point
 * nobody had written a clear for. Each caller documents beside its transform
 * getter what the key covers.
 *
 * A `reaction`, not an `autorun`: the effect writes the hover, and an autorun
 * body that both read and wrote it would re-fire itself.
 *
 * The LGV family answers the same question through
 * `installClearHoverOnViewportChange`, which its fetch foundation installs for
 * every per-region display; the comparative family has no such foundation, so
 * the model that owns the surface installs this one. A new shared-canvas
 * container owes the same call (SHARED_CANVAS_VIEWS.md).
 */
export function installClearHoverOnSurfaceMove(
  self: SurfaceHoverHost,
  opts: { transform: () => unknown; name: string },
) {
  addDisposer(
    self,
    reaction(
      opts.transform,
      () => {
        self.setHoveredFeature(undefined)
      },
      { name: opts.name },
    ),
  )
}
