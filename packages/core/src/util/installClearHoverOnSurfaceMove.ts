import { addDisposer } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

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
 * synteny's `bandTransformKey`, dotplot's `plotTransform`, the breakpoint split
 * view's `overlayTransformKey`. Watching that value instead of listing entry
 * points is the design: the wheel was the entry point nobody had written a
 * clear for. Each caller documents beside its transform getter what the key
 * covers.
 *
 * `clear` rather than a duck-typed action name, because the three owners store
 * three different things: a synteny pick hit, a dotplot feature index, an
 * overlay curve id. The omission the per-display installer guards against
 * (`installClearHoverOnViewportChange`, which a mixin installs on six displays'
 * behalf) cannot happen here — a surface owner writes this call itself, and the
 * clear is the line above it.
 *
 * A `reaction`, not an `autorun`: the effect writes the hover, and an autorun
 * body that both read and wrote it would re-fire itself.
 *
 * The LGV family answers the same question through
 * `installClearHoverOnViewportChange`, which its fetch foundation installs for
 * every per-region display; a view that owns a canvas or an overlay spanning
 * several of them has no such foundation, so it installs this one. A new
 * shared-surface container owes the same call (SHARED_CANVAS_VIEWS.md).
 */
export function installClearHoverOnSurfaceMove(
  self: IStateTreeNode,
  opts: { transform: () => unknown; clear: () => void; name: string },
) {
  addDisposer(
    self,
    reaction(
      opts.transform,
      () => {
        opts.clear()
      },
      { name: opts.name },
    ),
  )
}
