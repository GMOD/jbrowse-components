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
       * Initial layout configuration from URL params. Processed once then cleared.
       */
      init: types.frozen<DockviewLayoutNode | undefined>(),
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
       * Set the initial layout configuration (from URL params)
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

      /**
       * #action
       * Move a view up within its panel's view stack
       */
      moveViewUpInPanel(viewId: string) {
        for (const viewIds of self.panelViewAssignments.values()) {
          const idx = viewIds.indexOf(viewId)
          if (idx > 0) {
            const temp = viewIds[idx - 1]!
            viewIds[idx - 1] = viewIds[idx]!
            viewIds[idx] = temp
            break
          }
        }
      },

      /**
       * #action
       * Move a view down within its panel's view stack
       */
      moveViewDownInPanel(viewId: string) {
        for (const viewIds of self.panelViewAssignments.values()) {
          const idx = viewIds.indexOf(viewId)
          if (idx !== -1 && idx < viewIds.length - 1) {
            const temp = viewIds[idx + 1]!
            viewIds[idx + 1] = viewIds[idx]!
            viewIds[idx] = temp
            break
          }
        }
      },

      /**
       * #action
       * Move a view to the top of its panel's view stack
       */
      moveViewToTopInPanel(viewId: string) {
        for (const viewIds of self.panelViewAssignments.values()) {
          const idx = viewIds.indexOf(viewId)
          if (idx > 0) {
            viewIds.splice(idx, 1)
            viewIds.unshift(viewId)
            break
          }
        }
      },

      /**
       * #action
       * Move a view to the bottom of its panel's view stack
       */
      moveViewToBottomInPanel(viewId: string) {
        for (const viewIds of self.panelViewAssignments.values()) {
          const idx = viewIds.indexOf(viewId)
          if (idx !== -1 && idx < viewIds.length - 1) {
            viewIds.splice(idx, 1)
            viewIds.push(viewId)
            break
          }
        }
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        dockviewLayout,
        panelViewAssignments,
        init: _init,
        activePanelId,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(dockviewLayout !== undefined ? { dockviewLayout } : {}),
        // mst types wrong, nullish needed
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        ...(panelViewAssignments && Object.keys(panelViewAssignments).length
          ? { panelViewAssignments }
          : {}),
        ...(activePanelId !== undefined ? { activePanelId } : {}),
      } as typeof snap
    })
}

export type DockviewLayoutMixinType = ReturnType<typeof DockviewLayoutMixin>
export type SessionWithDockviewLayout = Instance<DockviewLayoutMixinType>

export function isSessionWithDockviewLayout(
  session: IAnyStateTreeNode,
): session is SessionWithDockviewLayout {
  return 'dockviewLayout' in session && 'setDockviewLayout' in session
}
