import { createElementId } from '@jbrowse/core/util/types/mst'
import { cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'

import {
  resolveLayoutSpec,
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
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
  Instance,
} from '@jbrowse/mobx-state-tree'

/**
 * Duck-typed because `views` comes from MultipleViewsSessionMixin, which only
 * composition joins to this one; a host without it exists only in tests.
 */
interface LayoutHostSelf extends IStateTreeNode {
  views?: { id: string }[]
  setUseWorkspaces?: (useWorkspaces: boolean) => void
  orderViews?: (ids: string[]) => void
}
function sessionViewIds(self: LayoutHostSelf) {
  return self.views?.map(v => v.id)
}

/**
 * A caller's view list narrowed to the session's views, deduplicated. The list
 * may be stale, and `applyLayoutSpec` throws on an unknown or repeated id.
 */
function liveViewIds(self: LayoutHostSelf, allViewIds: string[]) {
  const live = sessionViewIds(self)
  return [
    ...new Set(live ? allViewIds.filter(id => live.includes(id)) : allViewIds),
  ]
}

/**
 * #stateModel WorkspaceLayoutMixin
 *
 * The whole workspace as one MST tree:
 *
 *   branch (a split)  >  panel (a grid cell)  >  tab  >  views (stacked)
 *
 * Every action is `tree -> tree` through the pure functions in `tree.ts`, so
 * undo is `applySnapshot` on this node.
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

// only a branch has `direction`, so the dispatcher is never ambiguous
const LayoutNode = types.union(
  {
    dispatcher: (snapshot: { direction?: string }) =>
      snapshot.direction ? LayoutBranch : LayoutPanel,
  },
  LayoutBranch,
  LayoutPanel,
)

/**
 * Random, not a counter: a counter restarts on page load while a restored
 * snapshot still holds its old ids, and these are `types.identifier`s.
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
         * Show only this cell, at the size of the whole workspace. Kept here
         * rather than as a flag on `PanelNode` so no `tree.ts` operation has to
         * say what it does to it.
         */
        maximizedPanelId: types.maybe(types.string),
      })
      .views(self => ({
        /**
         * Referentially stable, since `getSnapshot` is cached. Uncast on
         * purpose: this assignment is what checks the models above agree with
         * the interfaces in `tree.ts`.
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
         * The maximized cell alone, or the whole tree. The cell is resized to 1
         * because CSS hands out free space by grow factor only up to a total of
         * 1, so a third-of-a-row cell would draw a third of the window.
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
         * Both panel ids held outside the tree must name a live cell. A lost
         * active cell falls back to the first; a lost maximized cell leaves the
         * mode.
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

        // a maximized cell is the active one, so activating any other leaves
        // the mode rather than putting new views where nobody can see them
        function activate(panelId: string) {
          self.activePanelId = panelId
          if (self.maximizedPanelId !== panelId) {
            self.maximizedPanelId = undefined
          }
        }

        /** Every write to the tree, so the one place `livePanelIds` runs. */
        function apply(next: LayoutTree) {
          const before = panels(self.tree).length
          self.layout = cast(normalize(next) as never)
          // a new cell would appear where maximize hides it
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

        function everyViewId(action: string, allViewIds: string[] | undefined) {
          const ids = allViewIds ?? sessionViewIds(self)
          if (!ids) {
            throw new Error(
              `${action}(viewId, allViewIds): allViewIds is every view id in the session, and this session has no view list to default it from`,
            )
          }
          return ids
        }

        /**
         * Homes every view first, since from the classic stack none has a tab
         * yet. Returns where the view came from, or `undefined` if it is not in
         * the session, in which case nothing is applied.
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
          const pruned = pruneEmptyTabIn(placed, from.panel.id, from.tab.id)
          const source = panels(pruned).find(p => p.id === from.panel.id)
          const emptiedCell =
            source?.tabs.length === 1 &&
            source.tabs[0]!.id === from.tab.id &&
            source.tabs[0]!.viewIds.length === 0
          apply(
            emptiedCell
              ? pruneEmptyPanel(removeTab(pruned, from.tab.id), from.panel.id)
              : pruned,
          )
          return from
        }

        /**
         * The panel a dropped tab is leaving, or `undefined` if the tab or the
         * target is missing. Every drop gesture checks this before touching the
         * tree.
         */
        function dropSource(tabId: string, targetPanelId: string) {
          const source = findTab(self.tree, tabId)?.panel
          return source && self.hasPanel(targetPanelId) ? source : undefined
        }

        // `apply` stays private: as an action it would be a public "set layout"
        return {
          setActivePanelId(panelId: string | undefined) {
            if (panelId === undefined) {
              self.activePanelId = undefined
            } else {
              activate(panelId)
            }
          },
          /**
           * Show one cell at the size of the workspace, or go back; naming a
           * different cell moves the mode. Unmounts every other cell's views
           * rather than hiding them, to stay under the WebGL2 context ceiling
           * (`agent-docs/reference/GPU_PORTABILITY.md`).
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
            activate(panelId)
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
            // a split of a missing cell inserts nothing, and homing falls back
            // on activePanelId
            if (!self.hasPanel(panel.id)) {
              return undefined
            }
            activate(panel.id)
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
            activate(panelId)
            return tab
          },
          /**
           * Close a tab, and its cell too if that was the last tab and not the
           * workspace's last cell: a tabless cell renders nothing at all.
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
          // NO `removeView` here: composed into the session it would replace
          // `session.removeView`, and homing already drops a removed view
          /** Drop a dragged tab into an existing panel, as a tab. */
          dropTabInPanel(tabId: string, targetPanelId: string, index?: number) {
            const source = dropSource(tabId, targetPanelId)
            if (!source) {
              return
            }
            // a drop on the body of the tab's own cell asks for nothing
            if (source.id === targetPanelId && index === undefined) {
              return
            }
            let next = moveTabToPanel(self.tree, tabId, targetPanelId, index)
            if (source.id !== targetPanelId) {
              next = pruneEmptyPanel(next, source.id)
            }
            apply(next)
            activate(targetPanelId)
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
            // a panel's only tab dropped on its own edge collapses the split
            next = pruneEmptyPanel(next, source.id)
            apply(next)
            activate(panel.id)
            return panel.id
          },
          setSizes(branchId: string, sizes: number[]) {
            apply(setSizes(self.tree, branchId, sizes))
          },
          /**
           * Arrange the workspace as a spec states, in the shape a session
           * spec's `layout` takes: a leaf's `views` names views by index into
           * `session.views` or by id. A malformed leaf, an index past the end or
           * an unknown id throws.
           */
          applyLayoutSpec(spec: LayoutSpecNode) {
            const resolved = resolveLayoutSpec(spec, sessionViewIds(self))
            apply(treeFromSpec(resolved, nextId))
            self.activePanelId = panels(self.tree)[0]?.id
            return viewIdsInSpec(resolved)
          },
          /**
           * ViewMenu's "move to new tab": the view leaves its tab for a new one.
           * `allViewIds` is EVERY view in the session, defaulting to the host's
           * own list, since homing drops any view the list omits.
           */
          moveViewToNewTab(viewId: string, allViewIds?: string[]) {
            const tab: TabNode = { id: nextId('tab'), viewIds: [viewId] }
            const from = rehomeView(
              viewId,
              everyViewId('moveViewToNewTab', allViewIds),
              (tree, at) => addTab(tree, at.panel.id, tab),
            )
            if (!from) {
              return undefined
            }
            activate(from.panel.id)
            return tab.id
          },
          /**
           * ViewMenu's "move to split": the view leaves for a new cell to the
           * right (`row`) or below (`column`) of its own.
           */
          moveViewToSplit(
            viewId: string,
            direction: 'row' | 'column',
            allViewIds?: string[],
          ) {
            const tabId = nextId('tab')
            const panel: PanelNode = {
              id: nextId('panel'),
              size: 1,
              tabs: [{ id: tabId, viewIds: [viewId] }],
              activeTabId: tabId,
            }
            const from = rehomeView(
              viewId,
              everyViewId('moveViewToSplit', allViewIds),
              (tree, at) => splitPanel(tree, at.panel.id, direction, panel),
            )
            if (!from) {
              return undefined
            }
            activate(panel.id)
            return panel.id
          },
          /**
           * ViewMenu's "move to tab": the view joins an existing tab, which
           * becomes the one shown.
           */
          moveViewToTab(viewId: string, tabId: string, allViewIds?: string[]) {
            const target = findTab(self.tree, tabId)
            if (!target || target.tab.viewIds.includes(viewId)) {
              return
            }
            const from = rehomeView(
              viewId,
              everyViewId('moveViewToTab', allViewIds),
              tree => addViewToTab(tree, tabId, viewId),
            )
            const landed = findTab(self.tree, tabId)
            if (from && landed) {
              apply(setActiveTab(self.tree, landed.panel.id, tabId))
              activate(landed.panel.id)
            }
          },
          homeUnassignedViews(viewIds: string[]) {
            apply(home(self.tree, viewIds))
          },
        }
      })
      // a separate block so these reach the actions they wrap through `self`,
      // where a later override still gets called
      .actions(self => ({
        /**
         * Move one view to a new tab or a split beside its cell, keeping the
         * rest of the arrangement. PUBLIC API: protein3d and msaview call it
         * with the move alone, so `allViewIds` stays optional; it is read only
         * on a host with no view list.
         */
        setPendingMove(move: PendingMove | undefined, allViewIds?: string[]) {
          // the session's own list wins over a plugin's possibly stale copy
          const ids = sessionViewIds(self) ?? allViewIds
          if (!move || !ids?.includes(move.viewId)) {
            return
          }
          if (ids.length === 1) {
            self.homeUnassignedViews(ids)
          } else if (move.type === 'newTab') {
            self.moveViewToNewTab(move.viewId, ids)
          } else {
            self.moveViewToSplit(move.viewId, 'row', ids)
          }
          const home = tabContainingView(self.tree, move.viewId)
          if (home) {
            self.setActiveTab(home.panel.id, home.tab.id)
          }
        },
        /**
         * Re-arrange the whole workspace, one view per cell, in one of four
         * shapes. Pass `allViewIds` in `session.views` order so there is
         * nothing for `orderViews` to apply.
         */
        tileViews(mode: TileMode, allViewIds: string[]) {
          self.applyLayoutSpec(
            tileLayoutSpec(liveViewIds(self, allViewIds), mode),
          )
        },
        /**
         * #action
         * Arrange the session's views into panels. Calls `applyLayoutSpec`,
         * turns workspaces mode on for this session (a layout renders nowhere
         * else), and orders `session.views` to the spec's top-to-bottom
         * order, which tabs read their order from. Without the last two steps
         * the layout applies but does not display, or the tabs appear in the
         * wrong order. Leaves take view ids or indexes into `session.views`; a
         * layout that seats no view throws rather than leaving a blank tab. A
         * session spec's `layout` and an agent's live re-layout both call it.
         */
        layoutViews(spec: LayoutSpecNode) {
          const host: LayoutHostSelf = self
          if (!host.setUseWorkspaces || !host.orderViews) {
            throw new Error(
              'This session has no view list to arrange: layoutViews needs a host composed with MultipleViewsSessionMixin',
            )
          }
          const seated = viewIdsInSpec(
            resolveLayoutSpec(spec, sessionViewIds(self)),
          )
          if (seated.length === 0) {
            throw new Error(
              'The layout seats no views: a leaf names its views with "views" (view ids, or indexes into session.views) and a container nests "children"',
            )
          }
          host.setUseWorkspaces(true)
          const ids = self.applyLayoutSpec(spec)
          host.orderViews(ids)
          return ids
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
