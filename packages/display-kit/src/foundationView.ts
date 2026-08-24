import { getContainingView } from '@jbrowse/core/util/mstUtils'

import type { RegionHost } from './regionHost.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The view that hosts a display, typed once for every display in both
 * foundations as the `RegionHost` contract, so no consumer repeats the cast
 * `getContainingView` needs (it is view-type-agnostic) but which a foundation
 * has already committed to.
 *
 * `host` rather than `view`, because the two are different things: `host` is
 * the contract this layer reads (regions, viewport, scale), and a display that
 * needs the linear genome view itself (`pxToBp`, `showTrack`, its chrome
 * settings) declares its own `view` getter typed as that model. Naming the
 * contract after the view it happens to be satisfied by is how the display
 * layer came to depend on the view plugin.
 *
 * Components and structural helpers keep calling `getContainingView`: they take
 * duck-typed model shapes that deliberately don't carry the whole MST instance
 * type, so there is no `host` on them to read.
 */
export function containingHost(self: IStateTreeNode): RegionHost {
  return getContainingView(self) as RegionHost
}

/**
 * The render-lifecycle precondition for every LGV display, overriding
 * `RenderLifecycleMixin`'s default-true hook: don't run the upload/render
 * callbacks until the view is measured. Before that, a display's `renderState`
 * is sized off view geometry (`renderBlocks` → `visibleRegions` → `view.width`,
 * or a global display's `totalWidthPx` / `dynamicBlocks`) which throws by
 * design, and the render autorun's catch would show that as a GPU render-error
 * banner.
 *
 * Gating it once, for all of them, is what lets a display's `renderState` be a
 * plain resolved getter and its render callback gate only on its own data. The
 * render-lifecycle twin of `autorunOnReadyView`.
 */
export function foundationCanRender(self: { host: { initialized: boolean } }) {
  return self.host.initialized
}
