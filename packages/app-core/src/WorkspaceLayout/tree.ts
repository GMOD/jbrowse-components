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

export interface PanelNode {
  id: string
  /** share of the parent branch's space, relative to its siblings */
  size: number
  /** membership only — `session.views` is the order (see app-core/CLAUDE.md) */
  viewIds: string[]
}

export interface BranchNode {
  id: string
  size: number
  direction: 'row' | 'column'
  children: LayoutTree[]
}

export type LayoutTree = PanelNode | BranchNode

export function isBranch(node: LayoutTree): node is BranchNode {
  return 'children' in node
}

export function panels(node: LayoutTree): PanelNode[] {
  return isBranch(node) ? node.children.flatMap(panels) : [node]
}

export function findPanel(node: LayoutTree, panelId: string) {
  return panels(node).find(p => p.id === panelId)
}

export function panelContainingView(node: LayoutTree, viewId: string) {
  return panels(node).find(p => p.viewIds.includes(viewId))
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
 * Empty panels are NOT dropped. A panel with no views is a real state — it is
 * what "new empty tab" creates, and what remains when the last view in a split
 * is closed but the user still wants the space.
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
  // workspace has: the caller gets an empty panel to put the next view in.
  return removed ? normalize(removed) : { ...(root as PanelNode), viewIds: [] }
}

export function addViewToPanel(
  root: LayoutTree,
  panelId: string,
  viewId: string,
): LayoutTree {
  return (
    mapNode(root, panelId, found =>
      isBranch(found) || found.viewIds.includes(viewId)
        ? found
        : { ...found, viewIds: [...found.viewIds, viewId] },
    ) ?? root
  )
}

/** Remove a view from whichever panel holds it, leaving the panel in place. */
export function removeView(root: LayoutTree, viewId: string): LayoutTree {
  const home = panelContainingView(root, viewId)
  return home
    ? (mapNode(root, home.id, found =>
        isBranch(found)
          ? found
          : { ...found, viewIds: found.viewIds.filter(id => id !== viewId) },
      ) ?? root)
    : root
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

/**
 * Move a view into another panel — the drag-a-tab gesture, and the only one
 * that has to be atomic. Expressed as one function returning one tree, so
 * there is no instant at which the view is in both panels or neither, which is
 * the state the imperative bridge had to batch an MST action to avoid.
 */
export function moveViewToPanel(
  root: LayoutTree,
  viewId: string,
  targetPanelId: string,
): LayoutTree {
  return addViewToPanel(removeView(root, viewId), targetPanelId, viewId)
}
