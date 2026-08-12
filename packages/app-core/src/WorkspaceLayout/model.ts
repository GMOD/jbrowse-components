import { cast, types } from '@jbrowse/mobx-state-tree'

import {
  addViewToPanel,
  moveViewToPanel,
  normalize,
  panelContainingView,
  panels,
  pruneEmptyPanel,
  removePanel,
  removeView,
  setSizes,
  splitPanel,
} from './tree.ts'

import type { LayoutTree, PanelNode } from './tree.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel WorkspaceLayoutMixin
 *
 * The whole workspace, in one MST tree. There is no second owner, so there is
 * nothing to reconcile, no event to echo, and no window during which the two
 * disagree — which is the entire content of `useDockviewController`.
 *
 * Compare what this replaces: `dockviewLayout` (an opaque blob dockview owned
 * and we mirrored), `panelViewAssignments` (panel -> views, ours), and
 * `activePanelId`. The first two said overlapping things in two vocabularies.
 * Here a panel simply *contains* its views.
 *
 * Every action is `tree -> tree` through the pure functions in `tree.ts`, so
 * undo is `applySnapshot` on this node and nothing else has to be told.
 */

const LayoutPanel = types.model('LayoutPanel', {
  id: types.identifier,
  size: types.optional(types.number, 1),
  viewIds: types.array(types.string),
})

const LayoutBranch = types.model('LayoutBranch', {
  id: types.identifier,
  size: types.optional(types.number, 1),
  direction: types.enumeration('LayoutDirection', ['row', 'column']),
  children: types.array(
    types.late((): typeof LayoutPanel => LayoutNode as never),
  ),
})

// `children` is a union of both node kinds, resolved late because a branch
// contains branches. The dispatcher keys off `direction`, which only a branch
// has, so an ambiguous snapshot is impossible rather than merely unlikely.
const LayoutNode = types.union(
  {
    dispatcher: (snapshot: { direction?: string }) =>
      snapshot.direction ? LayoutBranch : LayoutPanel,
  },
  LayoutBranch,
  LayoutPanel,
)

let counter = 0
function nextPanelId() {
  counter += 1
  return `panel-${counter}`
}

export function WorkspaceLayoutMixin() {
  return types
    .model({
      layout: types.optional(LayoutNode, () => ({
        id: nextPanelId(),
        size: 1,
        viewIds: [],
      })),
      activePanelId: types.maybe(types.string),
    })
    .views(self => ({
      get tree(): LayoutTree {
        // the snapshot is the plain tree the pure functions take, and MST keeps
        // it up to date, so there is no conversion step to forget
        return JSON.parse(JSON.stringify(self.layout)) as LayoutTree
      },
    }))
    .views(self => ({
      get panels(): PanelNode[] {
        return panels(self.tree)
      },
      panelContainingView(viewId: string) {
        return panelContainingView(self.tree, viewId)
      },
      /** The views a panel renders, in `session.views` order. */
      viewIdsForPanel(panelId: string, order: string[]) {
        const found = panels(self.tree).find(p => p.id === panelId)
        const members = new Set(found?.viewIds ?? [])
        return order.filter(id => members.has(id))
      },
    }))
    .actions(self => {
      function apply(next: LayoutTree) {
        self.layout = cast(normalize(next) as never)
      }
      return {
        apply,
        splitPanel(
          panelId: string,
          direction: 'row' | 'column',
          before = false,
        ) {
          const newId = nextPanelId()
          apply(
            splitPanel(
              self.tree,
              panelId,
              direction,
              { id: newId, size: 1, viewIds: [] },
              before,
            ),
          )
          self.activePanelId = newId
          return newId
        },
        closePanel(panelId: string) {
          apply(removePanel(self.tree, panelId))
          if (self.activePanelId === panelId) {
            self.activePanelId = panels(self.tree)[0]?.id
          }
        },
        addViewToPanel(panelId: string, viewId: string) {
          apply(addViewToPanel(self.tree, panelId, viewId))
        },
        removeView(viewId: string) {
          apply(removeView(self.tree, viewId))
        },
        moveViewToPanel(viewId: string, panelId: string) {
          apply(moveViewToPanel(self.tree, viewId, panelId))
          self.activePanelId = panelId
        },
        setSizes(branchId: string, sizes: number[]) {
          apply(setSizes(self.tree, branchId, sizes))
        },
        /**
         * Drop a dragged view into an existing panel, as a tab.
         *
         * One action, so the tree never exists in a state where the view is in
         * both panels or neither. The imperative bridge needed an explicit
         * `runInAction` around the unassign+reassign pair for exactly this, and
         * a comment explaining that without it the reconcile autorun would
         * observe the gap and re-home the view.
         */
        dropViewInPanel(viewId: string, targetPanelId: string) {
          const source = panelContainingView(self.tree, viewId)
          let next = moveViewToPanel(self.tree, viewId, targetPanelId)
          if (source && source.id !== targetPanelId) {
            next = pruneEmptyPanel(next, source.id)
          }
          apply(next)
          self.activePanelId = targetPanelId
        },
        /** Drop a dragged view onto a panel edge: split, and land in the new half. */
        dropViewInNewSplit(
          viewId: string,
          targetPanelId: string,
          direction: 'row' | 'column',
          before: boolean,
        ) {
          const source = panelContainingView(self.tree, viewId)
          const newId = nextPanelId()
          let next = splitPanel(
            self.tree,
            targetPanelId,
            direction,
            { id: newId, size: 1, viewIds: [] },
            before,
          )
          next = moveViewToPanel(next, viewId, newId)
          // Dragging a panel's only view onto that same panel's edge prunes the
          // now-empty source, which collapses the split — the gesture undoes
          // itself rather than leaving a blank half, without needing a case.
          if (source) {
            next = pruneEmptyPanel(next, source.id)
          }
          apply(next)
          self.activePanelId = newId
          return newId
        },
        setActivePanelId(panelId: string | undefined) {
          self.activePanelId = panelId
        },
        /**
         * Put any view that no panel holds into the active panel. The only
         * reconciliation left, and it is one-directional: views are owned
         * elsewhere (`session.views`), so a newly launched one has to land
         * somewhere. Nothing reads back.
         */
        homeUnassignedViews(viewIds: string[]) {
          const home =
            (self.activePanelId &&
            panels(self.tree).some(p => p.id === self.activePanelId)
              ? self.activePanelId
              : undefined) ?? panels(self.tree)[0]?.id
          if (!home) {
            return
          }
          let next = self.tree
          for (const viewId of viewIds) {
            if (!panelContainingView(next, viewId)) {
              next = addViewToPanel(next, home, viewId)
            }
          }
          // views the session no longer has stop being members
          for (const panel of panels(next)) {
            for (const viewId of panel.viewIds) {
              if (!viewIds.includes(viewId)) {
                next = removeView(next, viewId)
              }
            }
          }
          apply(next)
        },
      }
    })
}

export type WorkspaceLayoutMixinType = ReturnType<typeof WorkspaceLayoutMixin>
export interface WorkspaceLayout extends Instance<WorkspaceLayoutMixinType> {}
