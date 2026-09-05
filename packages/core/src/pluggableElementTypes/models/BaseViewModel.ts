import { getParent, hasParent, types } from '@jbrowse/mobx-state-tree'

import { isViewModel } from '../../util/types/index.ts'
import { ElementId, Region } from '../../util/types/mst.ts'

import type { MenuItem } from '../../ui/index.ts'
import type {
  AbstractTrackModel,
  AbstractViewModel,
} from '../../util/types/index.ts'
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
  Instance,
} from '@jbrowse/mobx-state-tree'

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
 * Where a derived view keeps things the base can enumerate: an ordinary view
 * has `tracks`, a container view has `trackContainers` instead (the synteny
 * view's per-band lists) and child views on `views`. All three are the
 * AbstractViewModel contract; this is the ONE place their shapes are walked,
 * so a consumer asks `ownTracks`/`allViews`/`allTracks` and never learns which
 * property a container keeps its children on.
 *
 * An entry answers only if it carries the contract itself: the dotplot keeps
 * its two 1D axis models under `views`, and react-msaview's view keeps its MSA
 * annotation rows under `tracks`. Neither is what the name says — an axis
 * composes no base and an annotation row has no displays — and descending into
 * one put undefined in the census.
 */
interface ViewTreeSelf extends IStateTreeNode {
  tracks?: unknown[]
  trackContainers?: { tracks?: unknown[] }[]
  views?: { allViews?: AbstractViewModel[] }[]
}

function isTrack(entry: unknown): entry is AbstractTrackModel {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'configuration' in entry &&
    'displays' in entry
  )
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
     * Every track open on this view itself: its own `tracks` array plus any
     * track containers it owns instead (the synteny view keeps one list per
     * band on `trackContainers` and its own `tracks` empty). Tracks on nested
     * views are `allTracks`'s, not this getter's.
     */
    get ownTracks(): AbstractTrackModel[] {
      const s = self as ViewTreeSelf
      return [
        ...(s.tracks ?? []),
        ...(s.trackContainers ?? []).flatMap(c => c.tracks ?? []),
      ].filter(isTrack)
    },
    /**
     * #getter
     * This view and every view nested inside it, to any depth — a synteny
     * stack's genome rows, a breakpoint split view's panels. Each view answers
     * for its own children, so a consumer never walks the nesting itself:
     * before this getter, four consumers each carried a copy of the walk and
     * two of them had drifted (one read `levels`, one read `trackContainers`,
     * and each was blind to the other's spelling).
     */
    get allViews(): AbstractViewModel[] {
      const s = self as ViewTreeSelf
      return [
        self as unknown as AbstractViewModel,
        ...(s.views ?? []).flatMap(v => v.allViews ?? []),
      ]
    },
  }))
  .views(self => ({
    /**
     * #getter
     * Every track open on this view or any view nested inside it.
     */
    get allTracks(): AbstractTrackModel[] {
      return self.allViews.flatMap(v => v.ownTracks)
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
