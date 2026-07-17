import { reorder } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { SerializedDockview } from 'dockview-react'

/**
 * Nested layout structure for initializing dockview.
 * A node is either a panel (has viewIds) or a container (has children).
 */
export interface DockviewLayoutNode {
  // Panel node - view IDs to display stacked vertically
  viewIds?: string[]
  // Container node - arranges children in a direction
  direction?: 'horizontal' | 'vertical'
  children?: DockviewLayoutNode[]
  // Size as percentage (0-100) of the parent container
  size?: number
}

/**
 * A view move requested before workspaces were enabled. Queued on the session
 * until the dockview container mounts and consumes it (mirrors `init`).
 */
export interface PendingMove {
  type: 'newTab' | 'splitRight'
  viewId: string
}

/**
 * #stateModel DockviewLayoutMixin
 * Session mixin that persists dockview layout state.
 * Each dockview panel can contain multiple views stacked vertically.
 */
export function DockviewLayoutMixin() {
  return (
    types
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
         * The initial nested layout to build dockview from (simple viewIds/
         * direction/size form, vs. the verbose `dockviewLayout` dockview emits).
         * Set from URL params (spec layout) OR carried in a loaded session
         * snapshot (e.g. the `encoded-` session param), then consumed once when
         * the dockview container mounts — `createInitialPanels` reads it,
         * `applyInitLayout` builds the panels, and it is cleared to undefined
         * (stripped from snapshots) so it never re-applies on a later remount.
         */
        init: types.stripDefault(
          types.maybe(types.frozen<DockviewLayoutNode>()),
          undefined,
        ),
      })
      // Transient: queued before workspaces were enabled and consumed when the
      // dockview container mounts. Volatile so it is never persisted.
      .volatile<{
        pendingMove: PendingMove | undefined
      }>(() => ({
        pendingMove: undefined,
      }))
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
          for (const [
            panelId,
            viewIds,
          ] of self.panelViewAssignments.entries()) {
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
         * Set the initial layout configuration (from URL params)
         */
        setInit(init: DockviewLayoutNode | undefined) {
          self.init = init
        },

        /**
         * #action
         * Queue a view move to be applied when the dockview container mounts
         */
        setPendingMove(pendingMove: PendingMove | undefined) {
          self.pendingMove = pendingMove
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
         * Move a view up within its panel's view stack
         */
        moveViewUpInPanel(viewId: string) {
          const loc = self.getPanelContainingView(viewId)
          if (loc) {
            self.panelViewAssignments.set(
              loc.panelId,
              reorder(loc.viewIds, loc.idx, 'up'),
            )
          }
        },

        /**
         * #action
         * Move a view down within its panel's view stack
         */
        moveViewDownInPanel(viewId: string) {
          const loc = self.getPanelContainingView(viewId)
          if (loc) {
            self.panelViewAssignments.set(
              loc.panelId,
              reorder(loc.viewIds, loc.idx, 'down'),
            )
          }
        },

        /**
         * #action
         * Move a view to the top of its panel's view stack
         */
        moveViewToTopInPanel(viewId: string) {
          const loc = self.getPanelContainingView(viewId)
          if (loc) {
            self.panelViewAssignments.set(
              loc.panelId,
              reorder(loc.viewIds, loc.idx, 'top'),
            )
          }
        },

        /**
         * #action
         * Move a view to the bottom of its panel's view stack
         */
        moveViewToBottomInPanel(viewId: string) {
          const loc = self.getPanelContainingView(viewId)
          if (loc) {
            self.panelViewAssignments.set(
              loc.panelId,
              reorder(loc.viewIds, loc.idx, 'bottom'),
            )
          }
        },
      }))
  )
}

export type DockviewLayoutMixinType = ReturnType<typeof DockviewLayoutMixin>
export type SessionWithDockviewLayout = Instance<DockviewLayoutMixinType>

export function isSessionWithDockviewLayout(
  session: IAnyStateTreeNode,
): session is SessionWithDockviewLayout {
  return 'dockviewLayout' in session && 'setDockviewLayout' in session
}
