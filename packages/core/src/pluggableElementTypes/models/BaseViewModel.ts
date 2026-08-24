import { types } from '@jbrowse/mobx-state-tree'

import { ElementId, Region } from '../../util/types/mst.ts'

import type { MenuItem } from '../../ui/index.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
     */
    bodyMounted: true,
  }))
  .views(() => ({
    /**
     * #method
     */
    menuItems(): MenuItem[] {
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
