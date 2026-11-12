import {
  descendants,
  eachAfter,
  hierarchy as coreHierarchy,
  leaves,
  links,
} from '@gmod/newick'
import { alpha } from '@jbrowse/core/ui/palette'

import type { RowBand } from '../rows/bandRows.ts'
import type {
  HierarchyNode as CoreHierarchyNode,
  NewickNode,
} from '@gmod/newick'

// Stroke for tree branch lines, shared by the canvas and SVG draw paths. The
// sidebar paints a translucent `background.paper` panel behind the dendrogram,
// so the ink has to follow the theme with it: black ink on a dark panel does
// not read.
//
// Literal per mode rather than `alpha(text.primary, …)` so the light-mode value
// is fixed, byte for byte, in the exported SVG.
export function treeStroke(palette: { mode: 'light' | 'dark' }) {
  return palette.mode === 'dark' ? '#fff8' : '#0008'
}

/**
 * Colors for the hovered-subtree mark: the translucent band over the rows the
 * hovered node contains, plus the dot and ring on the node itself.
 *
 * Here, beside `treeStroke`, and theme-derived for the same reason it is — with
 * the extra term that getter does not need: a translucent fill composites
 * toward the background behind it, so an alpha picked against a light track
 * all but disappears on a dark one. `getMafColorPalette`'s codon fills answer
 * the same failure with per-mode alphas.
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
// leaves the stroke a clear pixel off the edge so it doesn't read as clipped.
export const TREE_LEFT_PAD = 2

// The generic tree machinery lives in @gmod/newick, shared with react-msaview.
// Its traversals are iterative: a dendrogram out of single-linkage clustering is
// a caterpillar, whose depth is its leaf count, and a recursive traversal
// throws RangeError past about 5000 tips. Everything below this point is
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
  /** A band forest's root, which joins the band trees and draws nothing. */
  forestRoot?: true
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

function placeLeaves<T>(
  laid: HierarchyNode<T>,
  firstRow: number,
  step: number,
) {
  for (const [i, leaf] of leaves(laid).entries()) {
    leaf.x = (firstRow + i + 0.5) * step
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
  // (the hit-test spatial index would keep the row height it was first built
  // with, so hovering the tree misses after a shift+scroll row resize).
  const laid = cloneHierarchy(root)
  const n = leaves(laid).length
  placeLeaves(laid, 0, n > 0 ? sizeX / n : 0)
  placeDepths([laid], sizeY, showBranchLength)
  return laid as unknown as PositionedHierarchyNode<T>
}

/**
 * Band trees laid out each on its own rows under one root that draws nothing:
 * leaf *i* of the clade starting at row `start` on row `start + i`. Depth is
 * one scale shared by every clade, as ComplexHeatmap draws slice dendrograms,
 * so branch lengths compare across bands and each band's farthest leaf meets
 * the right edge. Undefined where no clade has a branch to draw, one-row
 * bands being bare leaves.
 */
export function bandForestLayout(
  clades: readonly { clade: HierarchyNode<NewickNode>; start: number }[],
  rowHeight: number,
  sizeY: number,
  showBranchLength = false,
): PositionedHierarchyNode<NewickNode> | undefined {
  if (!clades.some(({ clade }) => clade.children?.length)) {
    return undefined
  }
  const laid = clades.map(({ clade, start }) => {
    const copy = cloneHierarchy(clade)
    placeLeaves(copy, start, rowHeight)
    return copy
  })
  placeDepths(laid, sizeY, showBranchLength)
  const root: HierarchyNode<NewickNode> & { forestRoot: true } = {
    data: { children: laid.map(c => c.data) },
    children: laid,
    parent: null,
    depth: 0,
    height: largest(laid.map(c => c.height)) + 1,
    x: laid.reduce((sum, c) => sum + c.x!, 0) / laid.length,
    y: insetY(0, sizeY),
    forestRoot: true,
  }
  for (const clade of laid) {
    clade.parent = root
  }
  return root as PositionedHierarchyNode<NewickNode>
}

/**
 * Depth positions for trees drawn side by side on one scale, each one's
 * farthest leaf at the right edge. One tree is the plain dendrogram.
 *
 * - Cladogram: by depth-to-leaf, `node.height`, root at the left inset and
 *   every leaf at the right edge regardless of balance, as ape::plot.phylo
 *   draws; depth-from-root would leave shallow leaves dangling short of the
 *   row labels. Also the fallback for a tree with no lengths at all, which has
 *   no phylogram to show.
 * - Incremental lengths (phylo): each node at its cumulative root distance,
 *   so leaves land at their true distance and the right edge is ragged. A
 *   root's own `length` is a stem up to an absent parent and counts for
 *   nothing.
 * - Absolute merge heights (hclust v4 and earlier): root at the left inset,
 *   leaves at the right edge, a merge at its height's fraction, as R's
 *   `plot.hclust` places it. A dendrogram written as `:` lengths lands on the
 *   same picture, because every leaf of one sits at the same distance from the
 *   root.
 */
function placeDepths<T extends { length?: number }>(
  trees: readonly HierarchyNode<T>[],
  sizeY: number,
  showBranchLength: boolean,
) {
  if (showBranchLength && trees.some(t => maxNodeHeight(t) > 0)) {
    if (trees.some(t => hasIncrementalBranchLengths(t))) {
      const dists = trees.map(rootDistances)
      const spans = dists.map(dist => largest(dist.values()))
      const max = largest(spans)
      for (const [i, dist] of dists.entries()) {
        for (const [n, d] of dist) {
          n.y = insetY(max === 0 ? 1 : (max - spans[i]! + d) / max, sizeY)
        }
      }
    } else {
      const max = largest(trees.map(t => maxNodeHeight(t)))
      for (const n of trees.flatMap(t => descendants(t))) {
        n.y = insetY(max === 0 ? 1 : 1 - (n.data.length ?? 0) / max, sizeY)
      }
    }
  } else {
    const max = largest(trees.map(t => t.height))
    for (const n of trees.flatMap(t => descendants(t))) {
      n.y = insetY(max === 0 ? 1 : (max - n.height) / max, sizeY)
    }
  }
}

function largest(values: Iterable<number>) {
  let max = 0
  for (const v of values) {
    max = Math.max(max, v)
  }
  return max
}

/**
 * The links a positioned tree draws: every parent-to-child link but those out
 * of a band forest's root.
 */
export function treeLinks<T>(root: PositionedHierarchyNode<T>) {
  const all = links(root)
  return root.forestRoot ? all.filter(link => link.source !== root) : all
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

// Each node's summed branch length below `node`, whose own stem counts for
// nothing.
function rootDistances<T extends { length?: number }>(node: HierarchyNode<T>) {
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
  return dist
}

/**
 * Every segment the positioned tree draws, in draw-space coordinates (`y` the
 * depth axis, `x` the row axis): per link, down the parent's depth line from
 * its row to the child's, then across the child's row to the child. The one
 * walk the canvas and the SVG export both draw from, so the two cannot drift.
 */
export function eachTreeSegment<T>(
  root: PositionedHierarchyNode<T>,
  segment: (x0: number, y0: number, x1: number, y1: number) => void,
) {
  for (const { source, target } of treeLinks(root)) {
    segment(source.y, source.x, source.y, target.x)
    segment(source.y, target.x, target.y, target.x)
  }
}

export function renderTreeSVG<T>(hierarchy: PositionedHierarchyNode<T>) {
  const parts: string[] = []
  eachTreeSegment(hierarchy, (x0, y0, x1, y1) => {
    parts.push(`M${x0},${y0}L${x1},${y1}`)
  })
  return parts.join('')
}

export function getLeafNames<T extends NewickNode>(
  node: HierarchyNode<T>,
): string[] {
  return leaves(node)
    .map(l => l.data.name)
    .filter((n): n is string => n !== undefined)
}

// True when focusing this subtree would hide nothing: the node already contains
// every row on screen. The root always does, and clicking it is a natural "show
// me everything" gesture — which is exactly the click that must not go through,
// because applying that filter leaves the rows where they are while making
// "Show all rows" appear as though something had changed. On MAF it is
// worse than cosmetic: `rowFocus` is a fetch argument and therefore an
// `rpcProps()` cache key, so a full-set filter drops every loaded region and
// re-downloads byte-identical rows.
//
// A count comparison rather than a set comparison, and that is sound only
// because of `treeDescribesRows` below: the tree is positioned at all only when
// its leaves are exactly the drawn rows, so a subtree holding as many leaves as
// there are rows holds *those* rows. Written as its own function to say that
// once — inline it reads like a cheap approximation of a set equality, and the
// next reader "fixes" it into one.
export function subtreeCoversEveryRow(
  leafNames: readonly string[],
  rowCount: number,
) {
  return leafNames.length === rowCount
}

// True when `root`'s leaves are exactly `rowNames`, in the same order — i.e.
// the tree still describes the rows the display is drawing.
//
// `clusterLayout` spaces the tree's own leaves evenly across the row axis, so
// leaf *i* lands on row *i* positionally and nothing reconciles leaf name to row
// name at draw time. Any disagreement therefore draws the whole dendrogram
// against rows it does not name.
//
// This is a *derived* check on purpose. `setRowOrder` drops a stale
// `rows.tree` for the writes that go through it, but rows also move without
// any order write at all: a discovered row set growing as regions load
// (multi-row features, multi-wiggle), a phased expansion switching on when the
// ploidy arrives (multi-sample variants). One check where the tree is
// positioned covers all of them, and covers whatever the next one turns out to
// be; bands ask it of each band's clade (`matchBandClades`).
export function treeDescribesRows(
  root: HierarchyNode<NewickNode>,
  rows: readonly { name: string }[],
): boolean {
  const leafNodes = leaves(root)
  return (
    leafNodes.length === rows.length &&
    leafNodes.every((leaf, i) => leaf.data.name === rows[i]!.name)
  )
}

// Position the (filtered) cluster tree for drawing: leaves spaced over
// `rowsContentHeight` px along the row axis, branches over `treeAreaWidth` along
// the depth axis. Undefined when there's no tree, no rows to align it against,
// or a tree that no longer describes those rows (see `treeDescribesRows`). Every
// tree-sidebar consumer routes through this so the clusterLayout argument order,
// the empty-state guard and the staleness gate can't drift between display
// types.
//
// `rows` are the rows actually drawn — the display's `sources`, after every
// reorder, filter and decoration it applies — never the pre-filter or pre-layout
// list.
//
// **`rowsContentHeight` must be `rows.length × effectiveRowHeight`** — the rows'
// full stacked extent, never the viewport they scroll inside. Leaf *i* lands at
// `(i + 0.5) × rowsContentHeight / n`, while everything drawn beside the tree
// puts row *i* at `i × effectiveRowHeight`: the hover highlight in
// `treeDrawingAutorun`, `SvgRowLabels`, and each display's own painting. Pass the
// viewport instead and the dendrogram still draws, still looks plausible, and
// silently names the wrong rows — the same failure `treeDescribesRows` guards
// against on the name axis, on the pixel axis instead. `TreeSidebarMixin`'s
// `rowsContentHeight` is that product.
//
// With `bands`, each band draws the clade whose leaves are exactly its rows in
// order, if the tree holds one, laid out on its own rows under a root that
// draws nothing, so a band whose rows changed loses only its own dendrogram.
export function computeClusterHierarchy(
  root: HierarchyNode<NewickNode> | undefined,
  rows: readonly { name: string }[] | undefined,
  rowsContentHeight: number,
  treeAreaWidth: number,
  showBranchLength: boolean,
  bands: readonly RowBand[] = [],
) {
  if (!root || !rows?.length) {
    return undefined
  }
  if (bands.length) {
    const clades = matchBandClades(root, rows, bands)
    return bandForestLayout(
      bands.flatMap(({ start }, i) => {
        const clade = clades[i]
        return clade ? [{ clade, start }] : []
      }),
      rowsContentHeight / rows.length,
      treeAreaWidth,
      showBranchLength,
    )
  }
  return treeDescribesRows(root, rows)
    ? clusterLayout(root, rowsContentHeight, treeAreaWidth, showBranchLength)
    : undefined
}

const NO_BAND = -1

/**
 * Each band's clade: the node whose leaves are exactly the band's rows, in
 * order, or undefined where the tree holds none. One post-order walk labels
 * every node with the band its leaves share and how many there are, so the
 * whole match is linear in the tree.
 */
export function matchBandClades<T extends NewickNode>(
  root: HierarchyNode<T>,
  rows: readonly { name: string }[],
  bands: readonly RowBand[],
): (HierarchyNode<T> | undefined)[] {
  const bandOfRow = new Map<string, number>()
  for (const [b, { start, end }] of bands.entries()) {
    for (let i = start; i < end; i++) {
      bandOfRow.set(rows[i]!.name, b)
    }
  }
  const band = new Map<HierarchyNode<T>, number>()
  const count = new Map<HierarchyNode<T>, number>()
  const clades = bands.map((): HierarchyNode<T> | undefined => undefined)
  eachAfter(root, (node: HierarchyNode<T>) => {
    let b: number
    let n: number
    if (node.children?.length) {
      b = band.get(node.children[0]!)!
      n = 0
      for (const child of node.children) {
        n += count.get(child)!
        if (band.get(child) !== b) {
          b = NO_BAND
        }
      }
    } else {
      const { name } = node.data
      b = (name === undefined ? undefined : bandOfRow.get(name)) ?? NO_BAND
      n = 1
    }
    band.set(node, b)
    count.set(node, n)
    if (b >= 0 && n === bands[b]!.end - bands[b]!.start) {
      clades[b] = node
    }
  })
  return clades.map((clade, b) => {
    const { start } = bands[b]!
    return clade &&
      leaves(clade).every((leaf, i) => leaf.data.name === rows[start + i]!.name)
      ? clade
      : undefined
  })
}
