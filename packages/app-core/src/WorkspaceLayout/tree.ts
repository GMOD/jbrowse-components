/**
 * The layout tree, as pure functions over plain snapshots.
 *
 * This is the half of an MST-native workspace that carries the risk, so it is
 * deliberately not MST: no nodes, no parents, no lifecycle, nothing to be alive
 * or dead. Every operation is `tree in -> tree out`, which means the invariants
 * below can be tested exhaustively instead of observed to hold.
 *
 * The trade being made is worth naming, because it is not "complexity for no
 * complexity". Reconciling with dockview is replaced by **normalisation**: a
 * tree that has just had a panel removed, or a branch split, is usually not in
 * canonical form, and every operation has to put it back. That is real work and
 * it is where this design's bugs would live. What it is not is timing: there is
 * no event, no re-entrancy, no window during which the tree is half-updated,
 * and no second owner to disagree with.
 */

/**
 * One tab. Its content is a **vertical stack of views**, which is JBrowse's own
 * concept and the reason a generic window manager never fits cleanly: dockview
 * has a group holding tabs, and we need a third level under that.
 */
export interface TabNode {
  id: string
  /** membership only — `session.views` is the order (see app-core/CLAUDE.md) */
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

/**
 * A tab together with the panel holding it. Both finders below answer this,
 * because every caller needs the panel too — the tab alone cannot say where it
 * is, and the tree carries no parent pointers to walk back up.
 */
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

/**
 * The tab a panel is showing: the one it names, or its first.
 *
 * `activeTabId` is a `maybe` and a panel with no tabs has nothing to show, so
 * the fallback is the rule rather than a defensive check — and it is one rule,
 * read by the model's `activeTabOf`, by homing, and by the strip that draws it.
 */
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
 * Rule 3 is the one dockview cannot express: it forces orientation to alternate
 * by depth, so `row` inside `row` is not representable and a nested split gets
 * silently reparented. Here it is representable AND canonicalised, which is
 * what makes `size` work at any depth rather than only on the top-level split.
 *
 * Empty panels are NOT dropped, and neither are empty tabs. A tab with no views
 * is exactly what "new empty tab" creates — it shows the view launcher — so
 * pruning empties wholesale would delete the thing the user just asked for.
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
  return { ...node, children: renormalizeSizes(children) }
}

// Children of a flattened branch keep their share OF THE WHOLE: a child at half
// of a branch that was a third of its parent ends up at a sixth.
function scaleSizes(children: LayoutTree[], factor: number): LayoutTree[] {
  const total = children.reduce((sum, c) => sum + c.size, 0) || 1
  return children.map(c => ({ ...c, size: (c.size / total) * factor }))
}

function renormalizeSizes(children: LayoutTree[]): LayoutTree[] {
  const total = children.reduce((sum, c) => sum + c.size, 0)
  return total > 0
    ? children.map(c => ({ ...c, size: c.size / total }))
    : children.map(c => ({ ...c, size: 1 / children.length }))
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
 * Split `panelId`, putting `newPanel` beside it in `direction`.
 *
 * Always builds a branch around the panel and lets `normalize` flatten it into
 * the parent when the directions agree. Trying to decide up front whether to
 * nest or to insert as a sibling is the same decision rule twice, and the two
 * copies drift.
 */
export function splitPanel(
  root: LayoutTree,
  panelId: string,
  direction: 'row' | 'column',
  newPanel: PanelNode,
  before = false,
): LayoutTree {
  // derived rather than minted: this function is pure, and the new panel's id
  // is already unique in the tree, so a branch named after it is too
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
  // Removing the only panel leaves nothing to render, which is not a state the
  // workspace has: the caller gets an empty panel to put the next tab in.
  // `activeTabId` has to go with the tabs — it named one of them, and a panel
  // pointing at a tab it no longer has is the dangling state every other
  // operation here is careful not to leave (see integrity.test.ts).
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
            children: renormalizeSizes(
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

// --- tabs ------------------------------------------------------------------
//
// A tab is the unit the user drags, closes and renames; a view is what lives
// inside one. Keeping them separate is what dockview models as group/panel, and
// it is the level the first version of this tree left out entirely.

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
          ? // fall to the neighbour on the left, as every tabbed UI does —
            // which for the leftmost tab is the one that slid into its place
            remaining[Math.max(at - 1, 0)]?.id
          : panel.activeTabId,
    }
  })
}

/**
 * Move a tab into another panel, at `index` if given.
 *
 * One function returning one tree, so there is no instant at which the tab is
 * in both panels or neither — the state the imperative bridge had to wrap an
 * explicit `runInAction` around to hide from its own reconcile autorun.
 *
 * **`index` counts the tabs as they are ordered NOW**, before the move. That is
 * the only reading a caller can supply, because it is the strip the user is
 * looking at — and it differs from the post-removal ordering exactly when the
 * tab is moving within its own panel and is currently to the LEFT of the gap it
 * was dropped in. Dragging A to the gap between B and C in `[A, B, C]` is index
 * 2 on screen; taking A out first makes that gap index 1, and inserting at 2
 * lands it after C instead. Adjusting here rather than in the caller keeps the
 * whole "remove then insert" mechanic inside the one function that does it.
 */
export function moveTabToPanel(
  root: LayoutTree,
  tabId: string,
  targetPanelId: string,
  index?: number,
): LayoutTree {
  const home = findTab(root, tabId)
  // The target has to be checked BEFORE the removal, not after. This function
  // takes the tab out and puts it back, so a target that cannot be found and is
  // not rejected here leaves the tab — and every view in it — nowhere at all.
  if (!home || !findPanel(root, targetPanelId)) {
    return root
  }
  const { tab } = home
  const from =
    home.panel.id === targetPanelId
      ? home.panel.tabs.findIndex(t => t.id === tabId)
      : -1
  return mapPanel(removeTab(root, tabId), targetPanelId, panel => {
    // No index means append, and it has to keep meaning that within one panel.
    // The shift below is about reading a STATED index against the strip on
    // screen; a caller that states nothing is not describing a gap, so shifting
    // its position lands the tab one place short of the end.
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
  const home = findTab(root, tabId)
  return home
    ? mapPanel(root, home.panel.id, panel => ({
        ...panel,
        tabs: panel.tabs.map(t => (t.id === tabId ? { ...t, title } : t)),
      }))
    : root
}

// --- views inside tabs -----------------------------------------------------

export function addViewToTab(
  root: LayoutTree,
  tabId: string,
  viewId: string,
): LayoutTree {
  const home = findTab(root, tabId)
  return home
    ? mapPanel(root, home.panel.id, panel => ({
        ...panel,
        tabs: panel.tabs.map(t =>
          t.id === tabId && !t.viewIds.includes(viewId)
            ? { ...t, viewIds: [...t.viewIds, viewId] }
            : t,
        ),
      }))
    : root
}

/** Take a view out of whatever tab holds it, leaving the tab in place. */
export function removeView(root: LayoutTree, viewId: string): LayoutTree {
  const home = tabContainingView(root, viewId)
  return home
    ? mapPanel(root, home.panel.id, panel => ({
        ...panel,
        tabs: panel.tabs.map(t => ({
          ...t,
          viewIds: t.viewIds.filter(id => id !== viewId),
        })),
      }))
    : root
}

/**
 * Drop a panel that has been left with no tabs, unless it is the only one.
 *
 * Deliberately NOT a normalisation rule. A panel with no tabs is reachable on
 * purpose, so pruning empties wholesale would delete a space the user asked
 * for. It is a step the *drag* gesture takes about its own source panel,
 * because dragging the last tab out of a split and leaving a blank half is the
 * one place an empty panel is clearly not what was meant.
 */
export function pruneEmptyPanel(root: LayoutTree, panelId: string): LayoutTree {
  const found = findPanel(root, panelId)
  return found && found.tabs.length === 0 && panels(root).length > 1
    ? removePanel(root, panelId)
    : root
}

/**
 * Drop a tab that a move has left with no views, unless it is the panel's last.
 *
 * The mirror of `pruneEmptyPanel`, and deliberately as narrow: an empty tab is
 * legitimate (it shows the view launcher), so this only ever runs on the tab a
 * move just emptied, never as a rule over the tree.
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
