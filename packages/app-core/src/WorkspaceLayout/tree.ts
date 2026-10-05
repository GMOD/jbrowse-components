/**
 * The layout tree as pure functions over plain snapshots, deliberately not MST
 * so its invariants can be tested exhaustively. Every operation returns a tree
 * in canonical form (`normalize`).
 */

/** One tab: a vertical stack of views. */
export interface TabNode {
  id: string
  /** membership only — `session.views` is the order (see WorkspaceLayout/CLAUDE.md) */
  viewIds: string[]
  /** set only when the user renames it; otherwise derived from the views */
  title?: string
}

/** A cell of the grid: the space a tab strip and one visible tab live in. */
export interface PanelNode {
  id: string
  /** share of the parent branch's space, relative to its siblings */
  size: number
  tabs: TabNode[]
  activeTabId?: string
}

export interface BranchNode {
  id: string
  size: number
  direction: 'row' | 'column'
  children: LayoutTree[]
}

export type LayoutTree = PanelNode | BranchNode

/** What an id is being minted for. Ids are prefixed with it, so they read. */
export type NodeKind = 'panel' | 'tab' | 'branch'

export function isBranch(node: LayoutTree): node is BranchNode {
  return 'children' in node
}

export function panels(node: LayoutTree): PanelNode[] {
  return isBranch(node) ? node.children.flatMap(panels) : [node]
}

function findPanel(node: LayoutTree, panelId: string) {
  return panels(node).find(p => p.id === panelId)
}

export function tabs(node: LayoutTree): TabNode[] {
  return panels(node).flatMap(p => p.tabs)
}

/** A tab and the panel holding it — there are no parent pointers to walk. */
export interface TabHome {
  panel: PanelNode
  tab: TabNode
}

function homeOf(
  node: LayoutTree,
  match: (tab: TabNode) => boolean,
): TabHome | undefined {
  for (const panel of panels(node)) {
    const tab = panel.tabs.find(match)
    if (tab) {
      return { panel, tab }
    }
  }
  return undefined
}

export function findTab(node: LayoutTree, tabId: string) {
  return homeOf(node, t => t.id === tabId)
}

/** The tab a panel is showing: the one it names, or its first. */
export function activeTabIn(panel: PanelNode): TabNode | undefined {
  return panel.tabs.find(t => t.id === panel.activeTabId) ?? panel.tabs[0]
}

export function tabContainingView(node: LayoutTree, viewId: string) {
  return homeOf(node, t => t.viewIds.includes(viewId))
}

export function panelContainingView(node: LayoutTree, viewId: string) {
  return tabContainingView(node, viewId)?.panel
}

/**
 * Put a tree back in canonical form. Four rules, applied bottom-up:
 *
 * 1. a branch with no children is dropped by its parent
 * 2. a branch with one child is replaced by that child, which inherits the
 *    branch's size — so the space the branch occupied does not move
 * 3. a branch directly inside a branch of the same direction is flattened into
 *    it, its children's sizes scaled to preserve their share of the whole
 * 4. sizes are renormalised so a node's siblings always sum to 1
 *
 * Empty panels and empty tabs stay: "new empty tab" creates one on purpose, to
 * show the view launcher.
 */
export function normalize(node: LayoutTree): LayoutTree {
  if (!isBranch(node)) {
    return node
  }
  const children = node.children
    .map(normalize)
    .filter(child => !(isBranch(child) && child.children.length === 0))
    .flatMap(child =>
      isBranch(child) && child.direction === node.direction
        ? scaleSizes(child.children, child.size)
        : [child],
    )

  if (children.length === 1) {
    return { ...children[0]!, size: node.size }
  }
  return { ...node, children: scaleSizes(children) }
}

/**
 * Siblings already summing to the target within this tolerance are left alone.
 * Rescaling is not the identity in floating point (seven equal panes oscillate
 * between sums of 0.9999999999999998 and 1.0000000000000002), so without it
 * `normalize` has no fixed point and every action fills undo with a no-op.
 */
const SIZE_EPSILON = 1e-9

/** Rescale siblings to sum to `total`; siblings summing to zero share equally. */
function scaleSizes(children: LayoutTree[], total = 1): LayoutTree[] {
  const sum = children.reduce((acc, c) => acc + c.size, 0)
  if (sum <= 0) {
    return children.map(c => ({ ...c, size: total / children.length }))
  }
  return Math.abs(sum - total) < SIZE_EPSILON
    ? children
    : children.map(c => ({ ...c, size: (c.size / sum) * total }))
}

/** Rebuild `node` with `replacer` applied to the subtree with id `targetId`. */
function mapNode(
  node: LayoutTree,
  targetId: string,
  replacer: (found: LayoutTree) => LayoutTree | undefined,
): LayoutTree | undefined {
  if (node.id === targetId) {
    return replacer(node)
  }
  if (!isBranch(node)) {
    return node
  }
  return {
    ...node,
    children: node.children.flatMap(child => {
      const mapped = mapNode(child, targetId, replacer)
      return mapped ? [mapped] : []
    }),
  }
}

/**
 * Split `panelId`, putting `newPanel` beside it in `direction`. Always wraps
 * the panel in a branch and lets `normalize` flatten it when directions agree.
 */
export function splitPanel(
  root: LayoutTree,
  panelId: string,
  direction: 'row' | 'column',
  newPanel: PanelNode,
  before = false,
): LayoutTree {
  // derived rather than minted: the new panel's id is unique, so this is too
  const branchId = `branch-${newPanel.id}`
  const split = mapNode(root, panelId, found => {
    const pair = before ? [newPanel, found] : [found, newPanel]
    return {
      id: branchId,
      size: found.size,
      direction,
      children: pair.map(child => ({ ...child, size: 1 })),
    }
  })
  return normalize(split ?? root)
}

/** Drop a panel. Its space goes back to its siblings via renormalisation. */
export function removePanel(root: LayoutTree, panelId: string): LayoutTree {
  const removed = mapNode(root, panelId, () => undefined)
  // The only panel empties instead, and `activeTabId` goes with its tabs so it
  // cannot dangle
  return removed
    ? normalize(removed)
    : { ...(root as PanelNode), tabs: [], activeTabId: undefined }
}

/** Set the sizes of one branch's children, e.g. from a splitter drag. */
export function setSizes(
  root: LayoutTree,
  branchId: string,
  sizes: number[],
): LayoutTree {
  return (
    mapNode(root, branchId, found =>
      isBranch(found) && sizes.length === found.children.length
        ? {
            ...found,
            children: scaleSizes(
              found.children.map((child, i) => ({ ...child, size: sizes[i]! })),
            ),
          }
        : found,
    ) ?? root
  )
}

/** Rebuild `root` with `replacer` applied to the panel with id `panelId`. */
function mapPanel(
  root: LayoutTree,
  panelId: string,
  replacer: (panel: PanelNode) => PanelNode,
): LayoutTree {
  return (
    mapNode(root, panelId, found =>
      isBranch(found) ? found : replacer(found),
    ) ?? root
  )
}

/** Rebuild `root` with `replacer` applied to the tab with id `tabId`. */
function mapTab(
  root: LayoutTree,
  tabId: string,
  replacer: (tab: TabNode) => TabNode,
): LayoutTree {
  const home = findTab(root, tabId)
  return home
    ? mapPanel(root, home.panel.id, panel => ({
        ...panel,
        tabs: panel.tabs.map(t => (t.id === tabId ? replacer(t) : t)),
      }))
    : root
}

// --- tabs ------------------------------------------------------------------

export function addTab(
  root: LayoutTree,
  panelId: string,
  tab: TabNode,
): LayoutTree {
  return mapPanel(root, panelId, panel => ({
    ...panel,
    tabs: [...panel.tabs, tab],
    activeTabId: tab.id,
  }))
}

/**
 * Close a tab. The panel stays — an empty panel shows the view launcher, which
 * is a state the user can reach deliberately.
 */
export function removeTab(root: LayoutTree, tabId: string): LayoutTree {
  const home = findTab(root, tabId)
  if (!home) {
    return root
  }
  return mapPanel(root, home.panel.id, panel => {
    const at = panel.tabs.findIndex(t => t.id === tabId)
    const remaining = panel.tabs.filter(t => t.id !== tabId)
    return {
      ...panel,
      tabs: remaining,
      activeTabId:
        panel.activeTabId === tabId
          ? // the left neighbour, or for the leftmost tab the one that slid in
            remaining[Math.max(at - 1, 0)]?.id
          : panel.activeTabId,
    }
  })
}

/**
 * Move a tab into another panel, at `index` if given, or append.
 *
 * `index` counts the strip the user sees, before the move. Within one panel a
 * tab left of the gap shifts it by one once removed: dragging A between B and C
 * in `[A, B, C]` is index 2 on screen but 1 after A comes out.
 */
export function moveTabToPanel(
  root: LayoutTree,
  tabId: string,
  targetPanelId: string,
  index?: number,
): LayoutTree {
  const home = findTab(root, tabId)
  // checked before the removal, or a missing target would delete the tab
  if (!home || !findPanel(root, targetPanelId)) {
    return root
  }
  const { tab } = home
  const from =
    home.panel.id === targetPanelId
      ? home.panel.tabs.findIndex(t => t.id === tabId)
      : -1
  return mapPanel(removeTab(root, tabId), targetPanelId, panel => {
    const at =
      index === undefined
        ? panel.tabs.length
        : Math.min(
            Math.max(from >= 0 && from < index ? index - 1 : index, 0),
            panel.tabs.length,
          )
    return {
      ...panel,
      tabs: [...panel.tabs.slice(0, at), tab, ...panel.tabs.slice(at)],
      activeTabId: tab.id,
    }
  })
}

export function setActiveTab(
  root: LayoutTree,
  panelId: string,
  tabId: string,
): LayoutTree {
  return mapPanel(root, panelId, panel =>
    panel.tabs.some(t => t.id === tabId)
      ? { ...panel, activeTabId: tabId }
      : panel,
  )
}

export function renameTab(
  root: LayoutTree,
  tabId: string,
  title: string | undefined,
): LayoutTree {
  return mapTab(root, tabId, tab => ({ ...tab, title }))
}

// --- views inside tabs -----------------------------------------------------

export function addViewToTab(
  root: LayoutTree,
  tabId: string,
  viewId: string,
): LayoutTree {
  return mapTab(root, tabId, tab =>
    tab.viewIds.includes(viewId)
      ? tab
      : { ...tab, viewIds: [...tab.viewIds, viewId] },
  )
}

/** Take a view out of whatever tab holds it, leaving the tab in place. */
export function removeView(root: LayoutTree, viewId: string): LayoutTree {
  const home = tabContainingView(root, viewId)
  return home
    ? mapTab(root, home.tab.id, tab => ({
        ...tab,
        viewIds: tab.viewIds.filter(id => id !== viewId),
      }))
    : root
}

/**
 * Make the tree's membership agree with `session.views`, which owns which views
 * exist. `viewIds` is the WHOLE set: a shorter list unhomes the rest.
 */
export function homeViews(
  root: LayoutTree,
  viewIds: string[],
  activePanelId: string | undefined,
  nextTabId: () => string,
): LayoutTree {
  const all = panels(root)
  const target = all.find(p => p.id === activePanelId) ?? all[0]
  if (!target) {
    return root
  }
  let next = root
  let homeTabId = activeTabIn(target)?.id
  if (!homeTabId) {
    // a tabless panel is legal but cannot hold a view, so give it a tab
    homeTabId = nextTabId()
    next = addTab(next, target.id, { id: homeTabId, viewIds: [] })
  }
  for (const viewId of viewIds) {
    if (!tabContainingView(next, viewId)) {
      next = addViewToTab(next, homeTabId, viewId)
    }
  }
  const owned = new Set(viewIds)
  const departed = tabs(next)
    .flatMap(t => t.viewIds)
    .filter(id => !owned.has(id))
  for (const viewId of departed) {
    next = removeView(next, viewId)
  }
  return next
}

/**
 * Drop a panel left with no tabs, unless it is the only one. Not a
 * normalisation rule: only the gesture that emptied the panel calls it.
 */
export function pruneEmptyPanel(root: LayoutTree, panelId: string): LayoutTree {
  const found = findPanel(root, panelId)
  return found && found.tabs.length === 0 && panels(root).length > 1
    ? removePanel(root, panelId)
    : root
}

/**
 * Drop a tab a move has left with no views, unless it is the panel's last.
 * Closing a tab's last view leaves the tab standing, as a place to open the
 * next one; only a move out of it prunes.
 */
export function pruneEmptyTabIn(
  root: LayoutTree,
  panelId: string,
  tabId: string,
): LayoutTree {
  const found = findPanel(root, panelId)
  if (!found || found.tabs.length <= 1) {
    return root
  }
  const tab = found.tabs.find(t => t.id === tabId)
  return tab?.viewIds.length === 0 ? removeTab(root, tabId) : root
}
