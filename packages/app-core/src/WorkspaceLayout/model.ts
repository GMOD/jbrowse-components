import { createElementId } from '@jbrowse/core/util/types/mst'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import {
  specForPendingMove,
  tileLayoutSpec,
  treeFromSpec,
  viewIdsInSpec,
} from './spec.ts'
import {
  activeTabIn,
  addTab,
  addViewToTab,
  findTab,
  moveTabToPanel,
  normalize,
  panelContainingView,
  panels,
  pruneEmptyPanel,
  pruneEmptyTabIn,
  removePanel,
  removeTab,
  removeView,
  renameTab,
  setActiveTab,
  setSizes,
  splitPanel,
  tabContainingView,
  tabs,
} from './tree.ts'

import type { LayoutSpecNode, PendingMove, TileMode } from './spec.ts'
import type {
  LayoutTree,
  NodeKind,
  PanelNode,
  TabHome,
  TabNode,
} from './tree.ts'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel WorkspaceLayoutMixin
 *
 * The whole workspace, in one MST tree. There is no second owner, so there is
 * nothing to reconcile, no event to echo, and no window during which the two
 * disagree — which is the entire content of `useDockviewController`.
 *
 * Three levels, matching what the workspace actually has and what a generic
 * window manager cannot quite express:
 *
 *   branch (a split)  >  panel (a grid cell)  >  tab  >  views (stacked)
 *
 * dockview models the first three as branch/group/panel and stops there; the
 * vertical stack of views inside a tab is ours, which is why
 * `panelViewAssignments` had to exist alongside dockview's own serialized grid.
 * Here it is one tree, and a tab simply *contains* its views.
 *
 * Every action is `tree -> tree` through the pure functions in `tree.ts`, so
 * undo is `applySnapshot` on this node and nothing else has to be told.
 */

const LayoutTab = types.model('LayoutTab', {
  id: types.identifier,
  viewIds: types.array(types.string),
  /** set only by an explicit rename; otherwise the name is derived from views */
  title: types.maybe(types.string),
})

const LayoutPanel = types.model('LayoutPanel', {
  id: types.identifier,
  size: types.optional(types.number, 1),
  tabs: types.array(LayoutTab),
  activeTabId: types.maybe(types.string),
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

/**
 * Panel and tab ids.
 *
 * Random, NOT a counter. These are `types.identifier`, so they must be unique
 * within the tree — and a counter is reset by every page load while the restored
 * snapshot still holds `panel-1`, `tab-1`, .... The first tab a returning user
 * opened would mint an id the tree already had.
 */
function nextId(kind: NodeKind) {
  return `${kind}-${createElementId()}`
}

function emptyPanel(): PanelNode {
  const tabId = nextId('tab')
  return {
    id: nextId('panel'),
    size: 1,
    tabs: [{ id: tabId, viewIds: [] }],
    activeTabId: tabId,
  }
}

export function WorkspaceLayoutMixin() {
  return types
    .model({
      layout: types.optional(LayoutNode, emptyPanel),
      activePanelId: types.maybe(types.string),
    })
    .views(self => ({
      /**
       * The plain tree the pure functions take.
       *
       * `getSnapshot` rather than a JSON round trip: MST keeps the snapshot on
       * a `keepAlive` computed, so this is cached and referentially stable
       * instead of re-serialising the whole layout on every read — and an
       * action here reads it several times. The stability also matters on the
       * way back in: `apply` assigns a tree built by spreading this one, so an
       * untouched subtree is the very object MST already holds and its
       * reconcile short-circuits on identity rather than walking it.
       *
       * Safe because nothing mutates it. Every function in `tree.ts` is
       * `tree in -> tree out` over spreads, which is the same property that
       * lets them be tested exhaustively.
       */
      get tree(): LayoutTree {
        return getSnapshot(self.layout) as LayoutTree
      },
    }))
    .views(self => ({
      get panels(): PanelNode[] {
        return panels(self.tree)
      },
      get tabs(): TabNode[] {
        return tabs(self.tree)
      },
      hasPanel(panelId: string) {
        return panels(self.tree).some(p => p.id === panelId)
      },
      findTab(tabId: string) {
        return findTab(self.tree, tabId)
      },
      tabContainingView(viewId: string) {
        return tabContainingView(self.tree, viewId)
      },
      panelContainingView(viewId: string) {
        return panelContainingView(self.tree, viewId)
      },
      /** The tab a panel is showing, or its first. */
      activeTabOf(panelId: string) {
        const panel = panels(self.tree).find(p => p.id === panelId)
        return panel ? activeTabIn(panel) : undefined
      },
    }))
    .actions(self => {
      function apply(next: LayoutTree) {
        self.layout = cast(normalize(next) as never)
      }

      // Put any view no tab holds into the active cell's active tab, and drop
      // members the session no longer has. The only reconciliation left, and it
      // is one-directional: views are owned by `session.views`, so a newly
      // launched one has to land somewhere. Nothing reads back.
      function home(tree: LayoutTree, viewIds: string[]): LayoutTree {
        let next = tree
        const all = panels(next)
        const activePanel = all.find(p => p.id === self.activePanelId) ?? all[0]
        if (!activePanel) {
          return next
        }
        let homeTabId = activeTabIn(activePanel)?.id
        if (!homeTabId) {
          const tab: TabNode = { id: nextId('tab'), viewIds: [] }
          next = addTab(next, activePanel.id, tab)
          homeTabId = tab.id
        }
        const owned = new Set(viewIds)
        for (const viewId of viewIds) {
          if (!tabContainingView(next, viewId)) {
            next = addViewToTab(next, homeTabId, viewId)
          }
        }
        // read the memberships once, then drop: `removeView` rebuilds the tree
        // each call, so walking a list taken from a tree it has already
        // replaced is what the old nested loop did by accident
        const departed = tabs(next)
          .flatMap(t => t.viewIds)
          .filter(id => !owned.has(id))
        for (const viewId of departed) {
          next = removeView(next, viewId)
        }
        return next
      }

      /**
       * The shape ViewMenu's two "give this view a home of its own" moves share.
       *
       * Home first: from the classic stack nothing has been assigned to a tab
       * yet, and the old code forked here instead — the live dockview api when
       * the workspace was up, an `init` when it was not. Then take the view out
       * of wherever homing put it, let `place` put it back somewhere new, and
       * prune the tab it left if that emptied it.
       *
       * Returns where the view came from, or `undefined` when it is not in the
       * session at all — in which case nothing is applied, since `place` is
       * what would have made the new home and it never runs.
       */
      function rehomeView(
        viewId: string,
        allViewIds: string[],
        place: (tree: LayoutTree, from: TabHome) => LayoutTree,
      ) {
        const tree = home(self.tree, allViewIds)
        const from = tabContainingView(tree, viewId)
        if (!from) {
          return undefined
        }
        const placed = place(removeView(tree, viewId), from)
        apply(pruneEmptyTabIn(placed, from.panel.id, from.tab.id))
        return from
      }

      return {
        apply,
        setActivePanelId(panelId: string | undefined) {
          self.activePanelId = panelId
        },
        setActiveTab(panelId: string, tabId: string) {
          apply(setActiveTab(self.tree, panelId, tabId))
          self.activePanelId = panelId
        },
        renameTab(tabId: string, title: string | undefined) {
          apply(renameTab(self.tree, tabId, title))
        },
        /** Split a grid cell; the new cell gets one empty tab. */
        splitPanel(
          panelId: string,
          direction: 'row' | 'column',
          before = false,
        ) {
          const panel = emptyPanel()
          apply(splitPanel(self.tree, panelId, direction, panel, before))
          // A split of a cell that is not there inserts nothing, so claiming
          // the id anyway would leave activePanelId naming a cell nobody draws
          // — and homing falls back on activePanelId.
          if (!self.hasPanel(panel.id)) {
            return undefined
          }
          self.activePanelId = panel.id
          return panel
        },
        closePanel(panelId: string) {
          apply(removePanel(self.tree, panelId))
          if (self.activePanelId === panelId) {
            self.activePanelId = panels(self.tree)[0]?.id
          }
        },
        /** "New empty tab": a tab in an existing cell, showing the launcher. */
        addTab(panelId: string, viewIds: string[] = []) {
          if (!self.hasPanel(panelId)) {
            return undefined
          }
          const tab: TabNode = { id: nextId('tab'), viewIds }
          apply(addTab(self.tree, panelId, tab))
          self.activePanelId = panelId
          return tab
        },
        closeTab(tabId: string) {
          apply(removeTab(self.tree, tabId))
        },
        addViewToTab(tabId: string, viewId: string) {
          apply(addViewToTab(self.tree, tabId, viewId))
        },
        // NO `removeView` HERE. This mixin is composed into the session, where
        // `removeView(view)` is already the action that takes a view out of
        // `session.views` — part of AbstractSessionModel, and what every close
        // button and every host calls. A same-named action here does not extend
        // it, it *replaces* it (types.compose merges, last one wins), so the
        // session action stopped being reachable at all: closing a view pruned
        // the layout tree and left the view in the session forever, and
        // `session.removeView(view)` passed a model where this wanted an id, so
        // it matched nothing and even the pruning was a no-op.
        //
        // Nothing needs one either way: `home` below drops any tab entry whose
        // view is no longer in `session.views`, so removing the view is the
        // whole operation and the tree follows.
        /**
         * Drop a dragged tab into an existing panel, as a tab.
         *
         * One action, so the tree never exists in a state where the tab is in
         * both panels or neither. The imperative bridge needed an explicit
         * `runInAction` around the unassign+reassign pair for exactly this, and
         * a comment explaining that without it the reconcile autorun would
         * observe the gap and re-home the view.
         */
        dropTabInPanel(tabId: string, targetPanelId: string, index?: number) {
          const source = findTab(self.tree, tabId)?.panel
          if (!source || !self.hasPanel(targetPanelId)) {
            return
          }
          let next = moveTabToPanel(self.tree, tabId, targetPanelId, index)
          if (source.id !== targetPanelId) {
            next = pruneEmptyPanel(next, source.id)
          }
          apply(next)
          self.activePanelId = targetPanelId
        },
        /** Drop a dragged tab on a panel edge: split, and land in the new half. */
        dropTabInNewSplit(
          tabId: string,
          targetPanelId: string,
          direction: 'row' | 'column',
          before: boolean,
        ) {
          const source = findTab(self.tree, tabId)?.panel
          // Split first, move second — so a tab that is not there must be
          // rejected before the split, or the cell it would have filled is
          // left behind empty.
          //
          // The target is checked for the reason `splitPanel` checks its own
          // result: splitting a cell that is not there inserts nothing, and
          // this would then set activePanelId to a cell nobody draws and
          // report the id back as if the drop had landed.
          if (!source || !self.hasPanel(targetPanelId)) {
            return undefined
          }
          const panel: PanelNode = {
            id: nextId('panel'),
            size: 1,
            tabs: [],
          }
          let next = splitPanel(
            self.tree,
            targetPanelId,
            direction,
            panel,
            before,
          )
          next = moveTabToPanel(next, tabId, panel.id)
          // Dragging a panel's only tab onto that same panel's edge prunes the
          // now-empty source, which collapses the split — the gesture undoes
          // itself rather than leaving a blank half, without needing a case.
          next = pruneEmptyPanel(next, source.id)
          apply(next)
          self.activePanelId = panel.id
          return panel.id
        },
        setSizes(branchId: string, sizes: number[]) {
          apply(setSizes(self.tree, branchId, sizes))
        },
        /**
         * Arrange the workspace as a spec states.
         *
         * There is no `init` property and no standing request: the spec is
         * converted and *becomes* the layout, here and now. `init` existed only
         * because dockview had to be told, could not be told before it mounted,
         * and had to be told again afterwards — three problems that all came
         * from the layout living somewhere this action could not reach.
         */
        applyLayoutSpec(spec: LayoutSpecNode) {
          apply(treeFromSpec(spec, nextId))
          self.activePanelId = panels(self.tree)[0]?.id
          return viewIdsInSpec(spec)
        },
        /**
         * Move one view relative to the others. PUBLIC API: an external plugin
         * calls this behind a `'setPendingMove' in session` guard
         * (jbrowse-plugin-protein3d, putting a protein view beside its genome
         * view). It survived the last storage change by being kept as sugar,
         * and it survives this one the same way — a capability-detecting caller
         * cannot tell you it lost a capability.
         */
        setPendingMove(move: PendingMove | undefined, allViewIds: string[]) {
          if (move) {
            this.applyLayoutSpec(specForPendingMove(move, allViewIds))
          }
        },
        /**
         * ViewMenu's "move to new tab": the view leaves its tab for a new one.
         *
         * `allViewIds` is EVERY view in the session, not just this one, and is
         * required for that reason. Homing is two-directional about membership
         * — it drops any view the list does not name — so defaulting it to
         * `[viewId]` (which it did) unhomed every other view in the workspace,
         * and the homing autorun then swept them all into one tab.
         */
        moveViewToNewTab(viewId: string, allViewIds: string[]) {
          const tab: TabNode = { id: nextId('tab'), viewIds: [viewId] }
          const from = rehomeView(viewId, allViewIds, (tree, at) =>
            addTab(tree, at.panel.id, tab),
          )
          if (!from) {
            return undefined
          }
          self.activePanelId = from.panel.id
          return tab.id
        },
        /**
         * ViewMenu's "move to split view": the view leaves for a new cell.
         * `allViewIds` is every view in the session — see `moveViewToNewTab`.
         */
        moveViewToSplitRight(viewId: string, allViewIds: string[]) {
          const tabId = nextId('tab')
          const panel: PanelNode = {
            id: nextId('panel'),
            size: 1,
            tabs: [{ id: tabId, viewIds: [viewId] }],
            activeTabId: tabId,
          }
          const from = rehomeView(viewId, allViewIds, (tree, at) =>
            splitPanel(tree, at.panel.id, 'row', panel),
          )
          if (!from) {
            return undefined
          }
          self.activePanelId = panel.id
          return panel.id
        },
        /**
         * The whole-workspace re-arrange: every view one cell, in one of four
         * shapes. Restored from the dockview header's four "Global:" commands,
         * which went with that component and were not reimplemented.
         *
         * `allViewIds` is passed in rather than read off the session for the
         * same reason `moveViewToNewTab` takes it: this mixin owns the tree and
         * has no view list of its own. Passing `session.views` order means the
         * arrangement it states is already the order views render in, so unlike
         * a session spec's layout there is nothing for `orderViews` to apply.
         */
        tileViews(mode: TileMode, allViewIds: string[]) {
          this.applyLayoutSpec(tileLayoutSpec(allViewIds, mode))
        },
        homeUnassignedViews(viewIds: string[]) {
          apply(home(self.tree, viewIds))
        },
      }
    })
}

export type WorkspaceLayoutMixinType = ReturnType<typeof WorkspaceLayoutMixin>
export interface WorkspaceLayout extends Instance<WorkspaceLayoutMixinType> {}

export function isSessionWithWorkspaceLayout(
  session: IAnyStateTreeNode,
): session is WorkspaceLayout {
  return 'layout' in session && 'splitPanel' in session
}
