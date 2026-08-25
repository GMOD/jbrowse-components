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
  homeViews,
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
 * Four levels, matching what the workspace actually has and what a generic
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
  return (
    types
      .model({
        layout: types.optional(LayoutNode, emptyPanel),
        activePanelId: types.maybe(types.string),
        /**
         * Show only this cell, at the size of the whole workspace.
         *
         * Deliberately HERE and not a `maximized` flag on `PanelNode`. On the
         * node it would be inside `tree.ts`, the half that carries the risk and
         * is proven by a randomised operation sequence asserting canonical form
         * after every step — and every operation would then have to say what it
         * does to the flag: a split of a maximized panel, a drag of its last tab
         * out, a normalize that collapses it into its parent. Beside
         * `activePanelId` it is the same class of thing as `activePanelId`,
         * including its failure mode, which `livePanelIds` already repairs.
         */
        maximizedPanelId: types.maybe(types.string),
      })
      .views(self => ({
        /**
         * The plain tree the pure functions take.
         *
         * `getSnapshot` is a `keepAlive` computed, so this is cached and
         * referentially stable — which also lets MST's reconcile short-circuit on
         * identity when `apply` writes an untouched subtree back.
         *
         * Uncast on purpose: the models below and the interfaces in `tree.ts` are
         * two spellings of one shape, and this assignment is the only thing that
         * checks they agree.
         */
        get tree(): LayoutTree {
          return getSnapshot(self.layout)
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
        /** The views a tab renders: its members, in `session.views` order. */
        viewIdsForTab(tabId: string, order: string[]) {
          const members = new Set(findTab(self.tree, tabId)?.tab.viewIds ?? [])
          return order.filter(id => members.has(id))
        },
        /** The tab a panel is showing, or its first. */
        activeTabOf(panelId: string) {
          const panel = panels(self.tree).find(p => p.id === panelId)
          return panel ? activeTabIn(panel) : undefined
        },
        /**
         * What to render: the maximized cell alone, or the whole tree.
         *
         * Sized to 1 rather than handed over as it sits. A pane's `size` is its
         * share of its siblings, and CSS distributes free space by grow factor
         * only up to a total of 1 — so a cell that was a third of a row, alone
         * in the workspace with `flexGrow: 0.33`, draws a third of the window
         * and leaves the rest blank.
         */
        get visibleTree(): LayoutTree {
          const maximized = panels(self.tree).find(
            p => p.id === self.maximizedPanelId,
          )
          return maximized ? { ...maximized, size: 1 } : self.tree
        },
      }))
      .actions(self => {
        /**
         * Both panel ids this model holds outside the tree must name a cell
         * that exists, whatever just stopped existing. A dangling
         * `activePanelId` puts homed views in a cell nobody draws; a dangling
         * `maximizedPanelId` draws nothing at all.
         *
         * Stated as the invariant rather than as "the panel I just closed",
         * because a removal collapses branches on the way out and the cell that
         * disappears is not always the one that was named.
         *
         * They fall back differently, and the difference is the whole reason
         * this is two lines rather than a loop. A workspace always shows some
         * cell, so `activePanelId` takes the first one; maximize is a mode the
         * user is IN, so losing its cell leaves the mode rather than picking an
         * arbitrary cell to hold the user in it.
         */
        function livePanelIds() {
          if (
            self.activePanelId !== undefined &&
            !self.hasPanel(self.activePanelId)
          ) {
            self.activePanelId = panels(self.tree)[0]?.id
          }
          if (
            self.maximizedPanelId !== undefined &&
            !self.hasPanel(self.maximizedPanelId)
          ) {
            self.maximizedPanelId = undefined
          }
        }

        /**
         * Every write to the tree, and therefore the one place the invariant
         * above is repaired.
         *
         * It used to be a `keepActivePanel()` the two closing actions called,
         * which was right while a closing action was the only way to retire a
         * cell. `maximizedPanelId` is not reached that way: BOTH drop gestures
         * prune their emptied source panel, and `applyLayoutSpec` replaces every
         * id in the tree at once. That is five call sites for one rule, which is
         * the shape that ends with one of them missing.
         */
        function apply(next: LayoutTree) {
          const before = panels(self.tree).length
          self.layout = cast(normalize(next) as never)
          // A cell appearing where it cannot be seen is the one thing maximize
          // must not do, so gaining one leaves the mode. Stated as the count
          // rather than at the three actions that split (`splitPanel`,
          // `dropTabInNewSplit`, `moveViewToSplitRight`) for the reason above —
          // and a fourth, `applyLayoutSpec`, arrives at it from the other side:
          // it replaces every id, so `livePanelIds` was going to clear the mode
          // regardless. Losing a cell needs nothing here; that IS `livePanelIds`.
          if (panels(self.tree).length > before) {
            self.maximizedPanelId = undefined
          }
          livePanelIds()
        }

        function home(tree: LayoutTree, viewIds: string[]) {
          return homeViews(tree, viewIds, self.activePanelId, () =>
            nextId('tab'),
          )
        }

        /**
         * The shape ViewMenu's two "give this view a home of its own" moves share.
         *
         * Homing first is what removed the old fork here — the live dockview api
         * when the workspace was up, an `init` when it was not — because from the
         * classic stack nothing has been assigned to a tab yet.
         *
         * Returns where the view came from, or `undefined` if it is not in the
         * session, in which case nothing is applied.
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

        /**
         * The panel a dropped tab is leaving, or `undefined` if the drop cannot
         * happen — which BOTH drop gestures have to establish before they touch
         * the tree, and for two different reasons. A missing tab leaves an
         * edge-drop's new cell behind empty; a missing target splits nothing while
         * the gesture goes on to point `activePanelId` at a cell nobody draws, and
         * makes `moveTabToPanel`'s remove-then-insert a deletion.
         *
         * One place, so the next drop gesture inherits the rule rather than
         * restating it — the two of them restating it is how one came to be
         * missing half of it.
         */
        function dropSource(tabId: string, targetPanelId: string) {
          const source = findTab(self.tree, tabId)?.panel
          return source && self.hasPanel(targetPanelId) ? source : undefined
        }

        // `apply` is deliberately not returned: it takes a whole tree, so as an
        // action it is a public "set the layout to this" on the session.
        return {
          setActivePanelId(panelId: string | undefined) {
            self.activePanelId = panelId
          },
          /**
           * Show one cell at the size of the workspace, or go back.
           *
           * A toggle rather than a pair, because the gesture is a toggle: the
           * strip's double-click and the cell menu's one item both mean "this
           * cell, or not any more". Maximizing a DIFFERENT cell while one is
           * already maximized moves the mode rather than restoring, which is
           * what the menu item on another cell's strip is asking for.
           *
           * Mounts no views that were not mounted — it is the same cell showing
           * the same tab — and unmounts every other cell's, so the WebGL2
           * context ceiling (`agent-docs/reference/GPU_CONTEXT_BUDGET.md`) can
           * only go down. That is the reason it is this and not a `display:
           * none` over a still-mounted workspace.
           */
          toggleMaximizedPanel(panelId: string) {
            if (!self.hasPanel(panelId)) {
              return
            }
            self.maximizedPanelId =
              self.maximizedPanelId === panelId ? undefined : panelId
            if (self.maximizedPanelId !== undefined) {
              self.activePanelId = panelId
            }
          },
          restorePanels() {
            self.maximizedPanelId = undefined
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
          /**
           * Close a tab, and the cell with it if that was its last.
           *
           * A cell whose tabs are all gone is the state `pruneEmptyPanel` was
           * written for — "dragging the last tab out of a split and leaving a
           * blank half is the one place an empty panel is clearly not what was
           * meant" — and closing that tab arrives at the identical half by a
           * different gesture. It rendered nothing at all, not even the launcher
           * an empty TAB shows, so the only way back out of it was the `+`.
           *
           * `pruneEmptyPanel` carries both guards already: a cell with tabs left
           * stays, and the last cell in the workspace stays whatever happens to
           * it, since there is nowhere for the tree to collapse to.
           */
          closeTab(tabId: string) {
            const panelId = findTab(self.tree, tabId)?.panel.id
            if (panelId === undefined) {
              return
            }
            apply(pruneEmptyPanel(removeTab(self.tree, tabId), panelId))
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
            const source = dropSource(tabId, targetPanelId)
            if (!source) {
              return
            }
            // A drop on the BODY of the cell the tab is already in asks for
            // nothing. There is no gap under the pointer to state a position, and
            // the indicator washes the whole cell — which says "be a tab of this
            // cell", which it already is. Appending reordered the strip to say
            // something the gesture never said, and sent the tab to the end.
            // dockview declines a centre drop on the group a tab came from too.
            //
            // The rule is the gesture's, not `moveTabToPanel`'s: no index there
            // still means append, which is the only reading a total function has.
            if (source.id === targetPanelId && index === undefined) {
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
            const source = dropSource(tabId, targetPanelId)
            if (!source) {
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
           * ViewMenu's "move to new tab": the view leaves its tab for a new one.
           *
           * `allViewIds` is EVERY view in the session, and is required for that
           * reason — homing drops any view the list does not name, so the
           * `[viewId]` default this used to carry unhomed all the others.
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
          homeUnassignedViews(viewIds: string[]) {
            apply(home(self.tree, viewIds))
          },
        }
      })
      /**
       * The two sugars, in their own block so they can reach the actions they are
       * sugar FOR through `self`.
       *
       * `this.applyLayoutSpec()` reaches sideways into the action literal the
       * block returned — the fork's `instantiateActions` does `fn.bind(actions)`
       * — so it is pinned to that block's implementation for good. A later block,
       * or a plugin's `extendStateModel`, replaces `self.applyLayoutSpec` and the
       * sideways hop goes on calling the one it replaced, with no error and no
       * type complaint. An extra layer costs a line.
       */
      .actions(self => ({
        /**
         * Move one view relative to the others. PUBLIC API: an external plugin
         * calls this behind a `'setPendingMove' in session` guard
         * (jbrowse-plugin-protein3d, putting a protein view beside its genome
         * view). It survived the last storage change by being kept as sugar, and
         * it survives this one the same way — a capability-detecting caller
         * cannot tell you it lost a capability.
         *
         * **`allViewIds` is therefore OPTIONAL, and has to stay that way.** The
         * plugin passes the move alone, because that was the whole signature when
         * its call site was written; requiring the second argument threw
         * `undefined.filter` out of a launch the plugin does not wrap, and the
         * figure was again the only thing that noticed. Keeping the NAME is half
         * of not breaking a runtime lookup — the call has to keep working as it
         * is spelled.
         */
        setPendingMove(move: PendingMove | undefined, allViewIds?: string[]) {
          // The session's whole set of views, for the one entry point that cannot
          // be handed it. Every other one takes it as an argument on purpose —
          // this mixin owns the tree and knows nothing else — and this would too,
          // if its caller were ours. Duck-typed because `views` is
          // MultipleViewsSessionMixin's and composition is the only thing that
          // puts the two together.
          const { views } = self as unknown as { views?: { id: string }[] }
          // Not `?? []`: homing drops every view the list does not name, so an
          // empty one would answer "put this view beside nothing" and unhome the
          // rest. Nothing to say is nothing to do.
          const ids = allViewIds ?? views?.map(v => v.id)
          if (!move || !ids) {
            return
          }
          self.applyLayoutSpec(specForPendingMove(move, ids))
          // Show where the view went. A spec states an arrangement and not a
          // selection, so `treeFromSpec` shows each cell's FIRST tab — and
          // `newTab` puts the moved view in a tab beside the others, which makes
          // it the one tab nobody can see. The plugin asking for this is asking
          // for its view to be on screen; `moveViewToNewTab`, the same gesture
          // from the View menu, has always ended with it there.
          const home = tabContainingView(self.tree, move.viewId)
          if (home) {
            self.setActiveTab(home.panel.id, home.tab.id)
          }
        },
        /**
         * The whole-workspace re-arrange: every view one cell, in one of four
         * shapes. Restored from the dockview header's four "Global:" commands,
         * which went with that component and were not reimplemented.
         *
         * `allViewIds` is passed in rather than read off the session for the same
         * reason `moveViewToNewTab` takes it: this mixin owns the tree and has no
         * view list of its own. Passing `session.views` order means the
         * arrangement it states is already the order views render in, so unlike a
         * session spec's layout there is nothing for `orderViews` to apply.
         */
        tileViews(mode: TileMode, allViewIds: string[]) {
          self.applyLayoutSpec(tileLayoutSpec(allViewIds, mode))
        },
      }))
  )
}

export type WorkspaceLayoutMixinType = ReturnType<typeof WorkspaceLayoutMixin>
export interface WorkspaceLayout extends Instance<WorkspaceLayoutMixinType> {}

export function isSessionWithWorkspaceLayout(
  session: IAnyStateTreeNode,
): session is WorkspaceLayout {
  return 'layout' in session && 'splitPanel' in session
}
