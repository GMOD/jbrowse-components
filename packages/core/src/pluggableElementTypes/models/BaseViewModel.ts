import { getParent, hasParent, types } from '@jbrowse/mobx-state-tree'

import { isViewModel } from '../../util/types/index.ts'
import { ElementId, Region } from '../../util/types/mst.ts'

import type { MenuItem } from '../../ui/index.ts'
import type {
  AbstractTrackModel,
  AbstractViewModel,
} from '../../util/types/index.ts'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * The view a view is nested in, if it is nested in one at all — a synteny row
 * inside its stack, a breakpoint panel inside its split view. `undefined` for
 * the ordinary case of a view sitting directly in the session, and for a view
 * not yet attached to a tree.
 *
 * `getContainingView` cannot answer this: it throws when there is no such
 * ancestor, which here is the common case rather than an error.
 */
function containingViewOf(node: IAnyStateTreeNode) {
  let current = node
  while (hasParent(current)) {
    current = getParent<IAnyStateTreeNode>(current)
    if (isViewModel(current)) {
      return current
    }
  }
  return undefined
}

/**
 * #stateModel BaseViewModel
 * #category view
 */

const BaseViewModel = types
  .model('BaseView', {
    /**
     * #property
     */
    id: ElementId,

    /**
     * #property
     * displayName is displayed in the header of the view, or assembly names
     * being used if none is specified
     */
    displayName: types.maybe(types.string),

    /**
     * #property
     * collapse the view to its header bar, keeping it in the session rather
     * than closing it
     */
    minimized: types.stripDefault(types.boolean, false),
  })
  .volatile(() => ({
    width: 800,
    /**
     * Whether the container has this view's body in the DOM.
     *
     * `ViewContainer` mounts a view's body only while an IntersectionObserver
     * says it is on screen, to hold the app under the WebGL2 context ceiling
     * (`reference/GPU_CONTEXT_BUDGET.md`). A view below the fold therefore has
     * no canvas, so nothing ever calls `markCanvasDrawn` and the pre-first-paint
     * term of `displayPhase` pins every display in it at `loading` with nothing
     * left to resolve it — which parks `[data-app-phase="ready"]` for the whole
     * app on a view the user cannot see.
     *
     * Defaults true so the containers that always mount a body — embedded
     * views, workspace panels, and any test rendering a display directly — are
     * unaffected and need not set it.
     *
     * The raw flag, written by this view's own container. A display asks
     * `effectiveBodyMounted` instead, because a nested view has no container of
     * its own.
     */
    bodyMounted: true,
  }))
  .views(self => ({
    /**
     * #getter
     * Whether this view's body is in the DOM, counting the views it is nested
     * inside — which is the question a display's phase actually asks.
     *
     * `bodyMounted` alone answers it only for a view a container renders
     * directly. A view nested in another view (a synteny row, a breakpoint
     * panel) has no container writing its flag, so it reads `true` forever
     * while its whole subtree is out of the DOM, and every display in it waits
     * for a first paint that nothing will make — the hang this flag exists to
     * prevent, one level down.
     *
     * An ancestor that does not carry the flag at all leaves the answer alone
     * rather than excusing the paint: only an explicit `false` unmounts, so a
     * duck-typed stand-in that forgot it keeps waiting, which is the failure
     * that shows up as a slow test rather than as a picture of an empty view.
     */
    get effectiveBodyMounted(): boolean {
      return (
        self.bodyMounted &&
        containingViewOf(self)?.effectiveBodyMounted !== false
      )
    },
    /**
     * #method
     */
    menuItems(): MenuItem[] {
      return []
    },
    /**
     * #getter
     * The tracks this view puts in the census — its own, not a nested view's.
     *
     * Empty here, and overridden by the views that have any: the base cannot
     * read `self.tracks` for them, because what a view keeps under that name
     * is the view's business. react-msaview's holds its MSA annotation rows —
     * `{ReactComponent, model}` objects with no configuration and no displays
     * — and a base that helped itself to them handed them to the readiness
     * marker as tracks, which error-paged every session holding an MSA view.
     */
    get ownTracks(): AbstractTrackModel[] {
      return []
    },
    /**
     * #getter
     * The views nested directly inside this one, which the census counts as
     * views in their own right — a synteny stack's genome rows, a breakpoint
     * split view's panels.
     *
     * Empty here for the same reason, and the dotplot is why it has to be a
     * declaration rather than a walk of `views`: that prop name holds its two
     * 1D *axis* models, which are view-shaped and are not views the user
     * opened. No structural test separates the two — only the view knows.
     */
    get ownViews(): AbstractViewModel[] {
      return []
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setDisplayName(name: string) {
      self.displayName = name
    },

    /**
     * #action
     * width is an important attribute of the view model, when it becomes set,
     * it often indicates when the app can start drawing to it. certain views
     * like lgv are strict about this because if it tries to draw before it
     * knows the width it should draw to, it may start fetching data for
     * regions it doesn't need to
     *
     * setWidth is updated by a ResizeObserver generally, the views often need
     * to know how wide they are to properly draw genomic regions
     */
    setWidth(newWidth: number) {
      self.width = newWidth
    },

    /**
     * #action
     * See `bodyMounted`. Written by the view's container, which is the only
     * thing that knows whether it rendered the body.
     */
    setBodyMounted(flag: boolean) {
      self.bodyMounted = flag
    },

    /**
     * #action
     */
    setMinimized(flag: boolean) {
      self.minimized = flag
    },
  }))

export default BaseViewModel

// the base view does not have type but any derived type needs to add type, so
// just add it here
export type IBaseViewModel = Instance<typeof BaseViewModel> & {
  type: string
  assemblyNames?: string[]
}

export const BaseViewModelWithDisplayedRegions = BaseViewModel.props({
  displayedRegions: types.array(Region),
})
export type IBaseViewModelWithDisplayedRegions = Instance<
  typeof BaseViewModelWithDisplayedRegions
>
