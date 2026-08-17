import {
  descendants,
  eachAfter,
  hierarchy as coreHierarchy,
  leaves,
  links,
} from '@gmod/newick'
import { alpha } from '@jbrowse/core/ui/palette'

import type { HierarchyNode as CoreHierarchyNode } from '@gmod/newick'

// Stroke for tree branch lines, shared by the canvas and SVG draw paths. The
// sidebar paints a translucent `background.paper` panel behind the dendrogram,
// so the ink has to follow the theme with it: black-on-white was legible in
// either mode only while the panel was hardcoded white, which is what made the
// sidebar a bright rectangle on a dark track.
//
// Literal per mode rather than `alpha(text.primary, …)` so the light-mode value
// stays exactly what it has always been, byte for byte, in the exported SVG.
export function treeStroke(palette: { mode: 'light' | 'dark' }) {
  return palette.mode === 'dark' ? '#fff8' : '#0008'
}

/**
 * Colors for the hovered-subtree mark: the translucent band over the rows the
 * hovered node contains, plus the dot and ring on the node itself.
 *
 * Here, beside `treeStroke`, and theme-derived for the same reason it is — with
 * the extra term that getter did not need. These were three `rgba(255,165,0,…)`
 * literals, the last hardcoded colors left in the package's drawing paths, and
 * the band's 0.2 was picked against a light track. A translucent fill
 * composites toward the background behind it, so on a dark track that band all
 * but disappears: the same failure `getMafColorPalette`'s codon fills document
 * and fix with per-mode alphas, and the same one `treeStroke` exists for.
 *
 * `palette.highlight` rather than a literal because it is already the token for
 * "this is the thing being pointed at" — maf's MSA overlay marks with the same
 * one at 0.4 fill / 0.8 border — so a custom theme moves the tree hover with
 * everything else that marks.
 */
export function treeHoverColors(palette: {
  mode: 'light' | 'dark'
  highlight: { main: string }
}) {
  const dark = palette.mode === 'dark'
  const { main } = palette.highlight
  return {
    /** band over the hovered node's rows */
    band: alpha(main, dark ? 0.38 : 0.2),
    /** filled dot on the node */
    node: alpha(main, dark ? 0.9 : 0.8),
    /** ring around that dot, so it reads against the band it sits in */
    nodeRing: main,
  }
}

// Left inset (CSS px) for the root branch line. The root sits at the smallest y
// (leftmost node in the left-to-right dendrogram); at y=0 its 1px-wide vertical
// stroke is centered on the canvas edge, so half of it is clipped off. Nudging
// the whole y-domain right keeps the root line fully on-screen — pad 2 (not 1)
// leaves the stroke a clear pixel off the edge so it doesn't read as clipped
// (reviewer: the tree's top level looked ~1px offscreen at pad 1).
export const TREE_LEFT_PAD = 2

// The generic tree machinery lives in @gmod/newick, shared with react-msaview.
// Its traversals are iterative: a dendrogram out of single-linkage clustering is
// a caterpillar, whose depth is its leaf count, and the recursive versions these
// replaced threw RangeError past about 5000 tips. Everything below this point is
// dendrogram layout, which is ours.
export { descendants, eachAfter, leaves, links }

// the shared node plus the coordinates clusterLayout writes onto it. The
// traversals are generic over the node type, so they hand this one back rather
// than the base, and nothing downstream has to cast.
export interface HierarchyNode<T> extends CoreHierarchyNode<T> {
  children: HierarchyNode<T>[] | null
  parent: HierarchyNode<T> | null
  x?: number
  y?: number
}

// declares the wider return type so the x/y writes below typecheck; every added
// field is optional, so no cast is needed
export function hierarchy<T>(
  data: T,
  childrenAccessor: (d: T) => T[] | undefined | null,
): HierarchyNode<T> {
  return coreHierarchy(data, childrenAccessor)
}

export interface PositionedHierarchyNode<T> extends HierarchyNode<T> {
  x: number
  y: number
  children: PositionedHierarchyNode<T>[] | null
  parent: PositionedHierarchyNode<T> | null
}

// Structural copy sharing `data` but with fresh node objects, so laying out a
// clone never mutates the input tree. Iterative for the same reason the shared
// traversals are: the copy is as deep as the tree it copies.
function cloneHierarchy<T>(root: HierarchyNode<T>): HierarchyNode<T> {
  const copyOf = (node: HierarchyNode<T>, parent: HierarchyNode<T> | null) => ({
    data: node.data,
    children: null,
    parent,
    depth: node.depth,
    height: node.height,
  })
  const copiedRoot: HierarchyNode<T> = copyOf(root, null)
  const stack = [{ source: root, copy: copiedRoot }]
  while (stack.length > 0) {
    const { source, copy } = stack.pop()!
    if (source.children) {
      copy.children = source.children.map(child => copyOf(child, copy))
      for (const [i, child] of source.children.entries()) {
        stack.push({ source: child, copy: copy.children[i]! })
      }
    }
  }
  return copiedRoot
}

export function clusterLayout<T extends { length?: number }>(
  root: HierarchyNode<T>,
  sizeX: number,
  sizeY: number,
  showBranchLength = false,
): PositionedHierarchyNode<T> {
  // Lay out a fresh copy rather than mutating `root` in place. Callers derive
  // `root` from a memoized tree (parsed once per newick), so mutating it both
  // corrupts that cache and — because the returned reference then never changes
  // — leaves MobX values derived from the layout stale when sizeX/sizeY change
  // (e.g. the hit-test spatial index froze at the row height it was first built
  // with, so hovering the tree missed after a shift+scroll row resize).
  const laid = cloneHierarchy(root)
  const leafNodes = leaves(laid)
  const n = leafNodes.length
  const step = n > 0 ? sizeX / n : 0
  for (let i = 0; i < n; i++) {
    leafNodes[i]!.x = (i + 0.5) * step
  }
  eachAfter(laid, node => {
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
  if (showBranchLength && maxNodeHeight(laid) > 0) {
    assignBranchLengthY(laid, sizeY)
  } else {
    assignDepthY(laid, sizeY)
  }
  return laid as unknown as PositionedHierarchyNode<T>
}

// Assigns y positions by topological depth-to-leaf — root at 0, every leaf at
// sizeY. `node.height` is already the distance from a node to its farthest
// descendant leaf, so positioning by `(rootHeight - height)` aligns all leaves
// at the right edge regardless of tree balance, matching ape::plot.phylo.
// Positioning by depth-from-root instead would leave shallow leaves dangling
// short of the row labels.
export function assignDepthY<T>(node: HierarchyNode<T>, sizeY: number) {
  const rootHeight = node.height
  for (const n of descendants(node)) {
    n.y = insetY(
      rootHeight === 0 ? 1 : (rootHeight - n.height) / rootHeight,
      sizeY,
    )
  }
}

// Maps a 0..1 fraction (0 = root, 1 = leaf) onto the tree's horizontal band,
// left-inset by TREE_LEFT_PAD so the root branch stroke isn't clipped.
function insetY(fraction: number, sizeY: number) {
  return TREE_LEFT_PAD + fraction * (sizeY - TREE_LEFT_PAD)
}

// Largest `length` in the subtree, which is the tree's overall scale under
// either encoding below: the root's merge height in the absolute form, the
// longest single branch in the incremental one. Only ever compared against 0
// (does this tree carry lengths at all) or used to normalize the absolute form,
// so the two readings do not need telling apart here. A subtree-filtered root
// need not hold the max, hence the full traversal.
export function maxNodeHeight<T extends { length?: number }>(
  node: HierarchyNode<T>,
): number {
  let max = 0
  for (const n of descendants(node)) {
    max = Math.max(max, n.data.length ?? 0)
  }
  return max
}

// Newick's `length` field means two different things depending on who wrote the
// tree, and the two need opposite layouts:
//
//   incremental  `(A:0.1,B:0.2)` — branch length, summed from the root
//   absolute     `(A,B)1.5`      — merge height, counted down from the root
//
// The absolute form is a bare number in the internal node's *label* slot, which
// only a dendrogram writer produces: `@gmod/hclust` wrote it through v4, and a
// session saved back then still holds one. Everything else — a MAF guide tree,
// and hclust from v5 on — writes `:` lengths.
//
// A leaf carrying a length is the tell, because the absolute form has no slot
// to give one: its numbers sit after a `)`, and a leaf has no `)`. Reading
// either form as the other inverts the tree, landing the root (which carries no
// length of its own) at the leaf edge.
export function hasIncrementalBranchLengths<T extends { length?: number }>(
  node: HierarchyNode<T>,
): boolean {
  return leaves(node).some(l => l.data.length !== undefined)
}

// Phylogram y positions, dispatching on which encoding the tree uses.
export function assignBranchLengthY<T extends { length?: number }>(
  node: HierarchyNode<T>,
  sizeY: number,
) {
  if (hasIncrementalBranchLengths(node)) {
    assignCumulativeLengthY(node, sizeY)
  } else {
    assignMergeHeightY(node, sizeY)
  }
}

// Absolute-merge-height form (hclust v4 and earlier): root (max height) at 0,
// every leaf (height 0) at sizeY, internal nodes proportional to where their
// cluster merged. Matches R's `plot.hclust` node placement exactly.
//
// A dendrogram written as `:` lengths takes the cumulative path below instead
// and lands on the same picture, because every leaf of one sits at the same
// distance from the root — the two are the same ruler read from opposite ends.
function assignMergeHeightY<T extends { length?: number }>(
  node: HierarchyNode<T>,
  sizeY: number,
) {
  const max = maxNodeHeight(node)
  for (const n of descendants(node)) {
    const h = n.data.length ?? 0
    n.y = insetY(max === 0 ? 1 : 1 - h / max, sizeY)
  }
}

// Incremental form (phylo): each node sits at its cumulative root distance, so
// leaves land at their true evolutionary distance and the right edge is ragged
// rather than flush. The root's own `length` is a stem up to an absent parent,
// so the walk starts the accumulator at 0 and ignores it.
function assignCumulativeLengthY<T extends { length?: number }>(
  node: HierarchyNode<T>,
  sizeY: number,
) {
  const dist = new Map<HierarchyNode<T>, number>()
  const stack = [{ node, acc: 0 }]
  while (stack.length > 0) {
    const { node: n, acc } = stack.pop()!
    dist.set(n, acc)
    if (n.children) {
      for (const child of n.children) {
        stack.push({ node: child, acc: acc + (child.data.length ?? 0) })
      }
    }
  }
  let max = 0
  for (const d of dist.values()) {
    max = Math.max(max, d)
  }
  for (const [n, d] of dist) {
    n.y = insetY(max === 0 ? 1 : d / max, sizeY)
  }
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
