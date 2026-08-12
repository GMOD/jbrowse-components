import { cast, types } from '@jbrowse/mobx-state-tree'

import {
  addTab,
  addViewToTab,
  findTab,
  moveTabToPanel,
  normalize,
  panelContainingView,
  panels,
  pruneEmptyPanel,
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

import type { LayoutTree, PanelNode, TabNode } from './tree.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

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

let counter = 0
function nextId(kind: 'panel' | 'tab') {
  counter += 1
  return `${kind}-${counter}`
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
      get tabs(): TabNode[] {
        return tabs(self.tree)
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
      /** The views a tab renders, in `session.views` order. */
      viewIdsForTab(tabId: string, order: string[]) {
        const members = new Set(findTab(self.tree, tabId)?.tab.viewIds ?? [])
        return order.filter(id => members.has(id))
      },
      /** The tab a panel is showing, or its first. */
      activeTabOf(panelId: string) {
        const panel = panels(self.tree).find(p => p.id === panelId)
        return (
          panel?.tabs.find(t => t.id === panel.activeTabId) ?? panel?.tabs[0]
        )
      },
    }))
    .actions(self => {
      function apply(next: LayoutTree) {
        self.layout = cast(normalize(next) as never)
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
        removeView(viewId: string) {
          apply(removeView(self.tree, viewId))
        },
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
          let next = moveTabToPanel(self.tree, tabId, targetPanelId, index)
          if (source && source.id !== targetPanelId) {
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
          if (source) {
            next = pruneEmptyPanel(next, source.id)
          }
          apply(next)
          self.activePanelId = panel.id
          return panel.id
        },
        setSizes(branchId: string, sizes: number[]) {
          apply(setSizes(self.tree, branchId, sizes))
        },
        /**
         * Put any view that no tab holds into the active panel's active tab,
         * and drop members the session no longer has.
         *
         * The only reconciliation left, and it is one-directional: views are
         * owned elsewhere (`session.views`), so a newly launched one has to
         * land somewhere. Nothing reads back.
         */
        homeUnassignedViews(viewIds: string[]) {
          let next = self.tree
          const all = panels(next)
          const activePanel =
            all.find(p => p.id === self.activePanelId) ?? all[0]
          if (!activePanel) {
            return
          }
          let homeTabId =
            activePanel.tabs.find(t => t.id === activePanel.activeTabId)?.id ??
            activePanel.tabs[0]?.id
          if (!homeTabId) {
            const tab: TabNode = { id: nextId('tab'), viewIds: [] }
            next = addTab(next, activePanel.id, tab)
            homeTabId = tab.id
          }
          for (const viewId of viewIds) {
            if (!tabContainingView(next, viewId)) {
              next = addViewToTab(next, homeTabId, viewId)
            }
          }
          for (const tab of tabs(next)) {
            for (const viewId of tab.viewIds) {
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
