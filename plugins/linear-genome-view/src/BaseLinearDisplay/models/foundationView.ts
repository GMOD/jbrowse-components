import { getContainingView } from '@jbrowse/core/util/mstUtils'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/model.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The containing LinearGenomeView, typed once for every display in both
 * foundations so no consumer repeats the cast `getContainingView` needs (it is
 * view-type-agnostic) but which a foundation has already committed to.
 *
 * `lgv` rather than `view` at the two call sites, because a display's containing
 * view is not always an LGV — the comparative displays' `view` is a synteny or
 * dotplot view — so the name says which one this is. Three displays had each
 * invented the getter under two names before it was hoisted onto the
 * foundations, and ~35 other sites repeated the cast inline.
 *
 * The two foundations still each declare `lgv`, over this: a display composes
 * exactly one of them, so the pair can never shadow each other, and hoisting the
 * declaration into the `RegionTooLargeMixin` they share would name it on a mixin
 * that is about the byte gate. What was left duplicated was the body, which is
 * what this is.
 *
 * Components and structural helpers keep calling `getContainingView`: they take
 * duck-typed model shapes that deliberately don't carry the whole MST instance
 * type, so there is no `lgv` on them to read.
 */
export function containingLgv(self: IStateTreeNode): LinearGenomeViewModel {
  return getContainingView(self) as LinearGenomeViewModel
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
export function foundationCanRender(self: { lgv: { initialized: boolean } }) {
  return self.lgv.initialized
}
