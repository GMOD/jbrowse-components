// stroke for tree branch lines, shared by the canvas and SVG draw paths
export const TREE_STROKE = '#0008'

// Left inset (CSS px) for the root branch line. The root sits at the smallest y
// (leftmost node in the left-to-right dendrogram); at y=0 its 1px-wide vertical
// stroke is centered on the canvas edge, so half of it is clipped off. Nudging
// the whole y-domain right by a pixel keeps the root line fully on-screen.
export const TREE_LEFT_PAD = 1

export interface HierarchyNode<T> {
  data: T
  children: HierarchyNode<T>[] | null
  parent: HierarchyNode<T> | null
  depth: number
  height: number
  value?: number
  x?: number
  y?: number
}

export interface PositionedHierarchyNode<T> extends HierarchyNode<T> {
  x: number
  y: number
  children: PositionedHierarchyNode<T>[] | null
  parent: PositionedHierarchyNode<T> | null
}

function wrap<T>(
  data: T,
  childrenAccessor: (d: T) => T[] | undefined | null,
  parent: HierarchyNode<T> | null,
  depth: number,
): HierarchyNode<T> {
  const kids = childrenAccessor(data)
  const node: HierarchyNode<T> = {
    data,
    children: null,
    parent,
    depth,
    height: 0,
  }
  if (kids?.length) {
    node.children = kids.map(d => wrap(d, childrenAccessor, node, depth + 1))
    let h = 0
    for (const child of node.children) {
      h = Math.max(h, child.height + 1)
    }
    node.height = h
  }
  return node
}

export function hierarchy<T>(
  data: T,
  childrenAccessor: (d: T) => T[] | undefined | null,
): HierarchyNode<T> {
  return wrap(data, childrenAccessor, null, 0)
}

export function sum<T>(
  node: HierarchyNode<T>,
  valueFn: (d: T) => number,
): HierarchyNode<T> {
  function visit(n: HierarchyNode<T>): number {
    let s = valueFn(n.data)
    if (n.children) {
      for (const child of n.children) {
        s += visit(child)
      }
    }
    n.value = s
    return s
  }
  visit(node)
  return node
}

export function sort<T>(
  node: HierarchyNode<T>,
  compareFn: (a: HierarchyNode<T>, b: HierarchyNode<T>) => number,
): HierarchyNode<T> {
  function visit(n: HierarchyNode<T>) {
    if (n.children) {
      n.children.sort(compareFn)
      for (const child of n.children) {
        visit(child)
      }
    }
  }
  visit(node)
  return node
}

export function leaves<N extends { children: N[] | null }>(node: N): N[] {
  const result: N[] = []
  function visit(n: N) {
    if (n.children) {
      for (const child of n.children) {
        visit(child)
      }
    } else {
      result.push(n)
    }
  }
  visit(node)
  return result
}

export function descendants<N extends { children: N[] | null }>(node: N): N[] {
  const result: N[] = []
  function visit(n: N) {
    result.push(n)
    if (n.children) {
      for (const child of n.children) {
        visit(child)
      }
    }
  }
  visit(node)
  return result
}

export function links<N extends { children: N[] | null }>(
  node: N,
): { source: N; target: N }[] {
  const result: { source: N; target: N }[] = []
  function visit(n: N) {
    if (n.children) {
      for (const child of n.children) {
        result.push({ source: n, target: child })
        visit(child)
      }
    }
  }
  visit(node)
  return result
}

export function clusterLayout<T extends { length?: number }>(
  root: HierarchyNode<T>,
  sizeX: number,
  sizeY: number,
  showBranchLength = false,
): PositionedHierarchyNode<T> {
  const leafNodes = leaves(root)
  const n = leafNodes.length
  const step = n > 0 ? sizeX / n : 0
  for (let i = 0; i < n; i++) {
    leafNodes[i]!.x = (i + 0.5) * step
  }
  eachAfter(root, node => {
    if (node.children) {
      let totalX = 0
      for (const child of node.children) {
        totalX += child.x!
      }
      node.x = totalX / node.children.length
    }
  })
  // A dendrogram with no merge heights (e.g. a topology-only tree) can't show a
  // meaningful phylogram, so fall back to the cladogram layout in that case.
  if (showBranchLength && maxNodeHeight(root) > 0) {
    assignBranchLengthY(root, sizeY)
  } else {
    assignDepthY(root, sizeY)
  }
  return root as unknown as PositionedHierarchyNode<T>
}

// Post-order traversal (children visited before their parent)
export function eachAfter<T>(
  node: HierarchyNode<T>,
  fn: (n: HierarchyNode<T>) => void,
) {
  if (node.children) {
    for (const child of node.children) {
      eachAfter(child, fn)
    }
  }
  fn(node)
}

// Assigns y positions by topological depth-to-leaf — root at 0, every leaf at
// sizeY. `node.height` is already the distance from a node to its farthest
// descendant leaf, so positioning by `(rootHeight - height)` aligns all leaves
// at the right edge regardless of tree balance, matching ape::plot.phylo.
// Positioning by depth-from-root instead would leave shallow leaves dangling
// short of the row labels.
export function assignDepthY<T>(node: HierarchyNode<T>, sizeY: number) {
  const rootHeight = node.height
  function visit(n: HierarchyNode<T>) {
    n.y = insetY(
      rootHeight === 0 ? 1 : (rootHeight - n.height) / rootHeight,
      sizeY,
    )
    if (n.children) {
      for (const child of n.children) {
        visit(child)
      }
    }
  }
  visit(node)
}

// Maps a 0..1 fraction (0 = root, 1 = leaf) onto the tree's horizontal band,
// left-inset by TREE_LEFT_PAD so the root branch stroke isn't clipped.
function insetY(fraction: number, sizeY: number) {
  return TREE_LEFT_PAD + fraction * (sizeY - TREE_LEFT_PAD)
}

// Largest merge height in the subtree. For an hclust dendrogram the `length`
// field on an internal node is its absolute merge height (the `(A,B)1.5` Newick
// form), so the root usually holds the max — but a subtree-filtered root does
// not, hence the full traversal.
export function maxNodeHeight<T extends { length?: number }>(
  node: HierarchyNode<T>,
): number {
  let max = node.data.length ?? 0
  if (node.children) {
    for (const child of node.children) {
      max = Math.max(max, maxNodeHeight(child))
    }
  }
  return max
}

// Phylogram (dendrogram) y positions from absolute merge heights: root (max
// height) at 0, every leaf (height 0) at sizeY, internal nodes proportional to
// where their cluster merged. Unlike a cumulative branch-length sum, this reads
// each node's height directly, matching the hclust `(A,B)1.5` encoding where the
// number is an absolute height, not an incremental branch length.
export function assignBranchLengthY<T extends { length?: number }>(
  node: HierarchyNode<T>,
  sizeY: number,
) {
  const max = maxNodeHeight(node)
  function visit(n: HierarchyNode<T>) {
    const h = n.data.length ?? 0
    n.y = insetY(max === 0 ? 1 : 1 - h / max, sizeY)
    if (n.children) {
      for (const child of n.children) {
        visit(child)
      }
    }
  }
  visit(node)
}

// The two orthogonal segments of a parent→child dendrogram connector, in
// draw-space coordinates (node.y = depth/horizontal axis, node.x = row/vertical
// axis). Single source of truth for the elbow geometry, shared by the canvas
// draw path and the SVG export so the two can never drift.
export function treeLinkSegments<N extends { x: number; y: number }>(
  source: N,
  target: N,
): [[number, number], [number, number]][] {
  return [
    // vertical: down the parent's depth line from its row to the child's row
    [
      [source.y, source.x],
      [source.y, target.x],
    ],
    // horizontal: across the child's row from the parent depth to the child
    [
      [source.y, target.x],
      [target.y, target.x],
    ],
  ]
}

export function renderTreeSVG<T>(hierarchy: PositionedHierarchyNode<T>) {
  const parts: string[] = []
  for (const { source, target } of links(hierarchy)) {
    for (const [[x0, y0], [x1, y1]] of treeLinkSegments(source, target)) {
      parts.push(`M${x0},${y0}L${x1},${y1}`)
    }
  }
  return parts.join('')
}
