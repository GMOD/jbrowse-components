import { reorder } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type { ReorderDirection } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { SerializedDockview } from 'dockview-react'

/**
 * Nested layout structure for initializing dockview.
 * A node is either a panel (has viewIds) or a container (has children).
 */
export interface DockviewLayoutNode {
  // Panel node - view IDs to display stacked vertically
  viewIds?: string[]
  // Container node - arranges children in a direction. 'tabs' puts them in one
  // tab group instead of splitting the space, which is how "move this view to
  // its own tab" is expressed.
  direction?: 'horizontal' | 'vertical' | 'tabs'
  children?: DockviewLayoutNode[]
  // Size as percentage (0-100) of the parent container. Meaningless under
  // 'tabs', where the children share one group's space.
  size?: number
}

/**
 * #stateModel DockviewLayoutMixin
 * Session mixin that persists dockview layout state.
 * Each dockview panel can contain multiple views stacked vertically.
 */
export function DockviewLayoutMixin() {
  return types
    .model({
      /**
       * #property
       * Serialized dockview layout state
       */
      dockviewLayout: types.stripDefault(
        types.maybe(types.frozen<SerializedDockview>()),
        undefined,
      ),
      /**
       * #property
       * Maps panel IDs to arrays of view IDs (for stacking views within a panel)
       */
      panelViewAssignments: types.stripDefault(
        types.map(types.array(types.string)),
        {},
      ),
      /**
       * #property
       * The currently active panel ID in dockview
       */
      activePanelId: types.stripDefault(types.maybe(types.string), undefined),
      /**
       * #property
       * The layout to (re)build dockview from, in the simple viewIds/
       * direction/size form rather than the verbose `dockviewLayout` dockview
       * emits. The single "arrange the panels like this" request: set from a
       * URL spec's `layout`, carried in a loaded session snapshot (the
       * `encoded-` session param), or written by "move view to a tab/split"
       * from the classic stack. useDockviewController applies it whenever it
       * appears — at mount and after, since a spec sets it on a session whose
       * workspace may already be up — then clears it to undefined (stripped
       * from snapshots) so it never re-applies.
       */
      init: types.stripDefault(
        types.maybe(types.frozen<DockviewLayoutNode>()),
        undefined,
      ),
    })
    .views(self => ({
      /**
       * #getter
       * Get view IDs for a specific panel, as a plain snapshot array. Never
       * the live MST node: callers iterate this while removing views (which
       * splices the underlying array via the reconcile autorun), so leaking
       * the live array would skip elements mid-iteration. Mutators go through
       * getPanelContainingView instead.
       */
      getViewIdsForPanel(panelId: string) {
        return self.panelViewAssignments.get(panelId)?.slice() ?? []
      },
      /**
       * #getter
       * Find the panel containing a view, returning the panel ID, that panel's
       * view-ID list, and the view's index within it (or undefined if unassigned)
       */
      getPanelContainingView(viewId: string) {
        for (const [panelId, viewIds] of self.panelViewAssignments.entries()) {
          const idx = viewIds.indexOf(viewId)
          if (idx !== -1) {
            return { panelId, viewIds, idx }
          }
        }
        return undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Save the current dockview layout
       */
      setDockviewLayout(layout: SerializedDockview | undefined) {
        self.dockviewLayout = layout
      },

      /**
       * #action
       * Set the active panel ID
       */
      setActivePanelId(panelId: string | undefined) {
        self.activePanelId = panelId
      },

      /**
       * #action
       * Request a panel arrangement; see the `init` property
       */
      setInit(init: DockviewLayoutNode | undefined) {
        self.init = init
      },

      /**
       * #action
       * Assign a view to a panel (adds to the panel's view stack)
       */
      assignViewToPanel(panelId: string, viewId: string) {
        const existing = self.panelViewAssignments.get(panelId)
        if (existing) {
          if (!existing.includes(viewId)) {
            existing.push(viewId)
          }
        } else {
          self.panelViewAssignments.set(panelId, [viewId])
        }
      },

      /**
       * #action
       * Remove a view from its panel
       */
      removeViewFromPanel(viewId: string) {
        const loc = self.getPanelContainingView(viewId)
        if (loc) {
          loc.viewIds.splice(loc.idx, 1)
          if (loc.viewIds.length === 0) {
            self.panelViewAssignments.delete(loc.panelId)
          }
        }
      },

      /**
       * #action
       * Remove a panel and all its view assignments
       */
      removePanel(panelId: string) {
        self.panelViewAssignments.delete(panelId)
      },

      /**
       * #action
       * Reorder a view within its panel's view stack. The workspace-mode
       * counterpart of the session's `moveViewUp`/`moveViewToTop`/... family,
       * which reorder `session.views` itself — here the panel's own view-id
       * list is the order that renders, so that is what moves.
       */
      moveViewInPanel(viewId: string, direction: ReorderDirection) {
        const loc = self.getPanelContainingView(viewId)
        if (loc) {
          self.panelViewAssignments.set(
            loc.panelId,
            reorder(loc.viewIds, loc.idx, direction),
          )
        }
      },
    }))
}

export type DockviewLayoutMixinType = ReturnType<typeof DockviewLayoutMixin>
export type SessionWithDockviewLayout = Instance<DockviewLayoutMixinType>

export function isSessionWithDockviewLayout(
  session: IAnyStateTreeNode,
): session is SessionWithDockviewLayout {
  return 'dockviewLayout' in session && 'setDockviewLayout' in session
}
