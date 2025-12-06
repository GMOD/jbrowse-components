import { types } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'
import type { SerializedDockview } from 'dockview-react'

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
      dockviewLayout: types.maybe(types.frozen<SerializedDockview>()),
      /**
       * #property
       * Maps panel IDs to arrays of view IDs (for stacking views within a panel)
       */
      panelViewAssignments: types.optional(
        types.map(types.array(types.string)),
        {},
      ),
      /**
       * #property
       * The currently active panel ID in dockview
       */
      activePanelId: types.maybe(types.string),
    })
    .views(self => ({
      /**
       * #getter
       * Get view IDs for a specific panel
       */
      getViewIdsForPanel(panelId: string) {
        return self.panelViewAssignments.get(panelId) ?? []
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
        for (const [panelId, viewIds] of self.panelViewAssignments.entries()) {
          const idx = viewIds.indexOf(viewId)
          if (idx !== -1) {
            viewIds.splice(idx, 1)
            if (viewIds.length === 0) {
              self.panelViewAssignments.delete(panelId)
            }
            break
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
    }))
}

export type DockviewLayoutMixinType = ReturnType<typeof DockviewLayoutMixin>
export type SessionWithDockviewLayout = Instance<DockviewLayoutMixinType>

export function isSessionWithDockviewLayout(
  session: IAnyStateTreeNode,
): session is SessionWithDockviewLayout {
  return 'dockviewLayout' in session && 'setDockviewLayout' in session
}
