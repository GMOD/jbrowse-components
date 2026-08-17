import { parseNewick } from '@gmod/newick'

import {
  clusterLayout,
  hasIncrementalBranchLengths,
  hierarchy,
  leaves,
} from './hierarchy.ts'

import type { HierarchyNode } from './hierarchy.ts'
import type { ClusterHierarchyNode, ClusterNodeData } from './types.ts'

export function getLeafNames<T extends ClusterNodeData>(
  node: HierarchyNode<T>,
): string[] {
  return leaves(node)
    .map(l => l.data.name)
    .filter((n): n is string => n !== undefined)
}

function findSubtree<T extends ClusterNodeData>(
  root: HierarchyNode<T>,
  filterSet: Set<string>,
): HierarchyNode<T> | undefined {
  // Single post-order pass: at each node track (leaf-name count below,
  // whether all those names are in filterSet). The first node whose count
  // equals filterSet.size and is fully contained is the unique match
  // (descendants have strictly fewer leaves).
  let found: HierarchyNode<T> | undefined
  function visit(n: HierarchyNode<T>): { count: number; allIn: boolean } {
    if (n.children?.length) {
      let count = 0
      let allIn = true
      for (const child of n.children) {
        const r = visit(child)
        count += r.count
        if (!r.allIn) {
          allIn = false
        }
      }
      if (!found && allIn && count === filterSet.size) {
        found = n
      }
      return { count, allIn }
    }
    const { name } = n.data
    if (name === undefined) {
      return { count: 0, allIn: true }
    }
    return { count: 1, allIn: filterSet.has(name) }
  }
  visit(root)
  return found
}

// Parse a Newick string and build a hierarchy, without applying a filter.
// Kept separate from applySubtreeFilter so MST can cache them independently —
// changing the subtree filter re-runs only the traversal, not the parser.
export function buildTree(newick: string): HierarchyNode<ClusterNodeData> {
  return hierarchy<ClusterNodeData>(parseNewick(newick), d => d.children)
}

// Prune a Newick-shaped tree down to just the leaves in `keep`, preserving the
// topology among them. Internal nodes left with a single child are collapsed
// into that child so the result has no spurious unary nodes. Returns undefined
// if no kept leaf is below `node`.
//
// Unlike `findSubtree` (which only matches a single monophyletic clade), this
// works for any leaf set — e.g. a scattered hand-picked species selection — so
// the rendered dendrogram always matches the visible rows rather than falling
// back to the full tree.
//
// `incrementalLengths` says which of the two `length` encodings the tree uses
// (see `hasIncrementalBranchLengths`). Only incremental lengths add up when a
// node collapses. In the absolute form — a merge height, from hclust v4 and the
// saved sessions that still carry it — summing invents a depth the child never
// had, and because that form leaves leaves bare, handing one a `length` flips
// the whole tree onto the cumulative phylogram layout.
export function pruneNewickToLeaves(
  node: ClusterNodeData,
  keep: Set<string>,
  incrementalLengths = true,
): ClusterNodeData | undefined {
  if (node.children?.length) {
    const children = node.children
      .map(c => pruneNewickToLeaves(c, keep, incrementalLengths))
      .filter((c): c is ClusterNodeData => c !== undefined)
    if (children.length === 0) {
      return undefined
    }
    if (children.length === 1) {
      const child = children[0]!
      return incrementalLengths
        ? { ...child, length: (child.length ?? 0) + (node.length ?? 0) }
        : child
    }
    return { ...node, children }
  }
  return node.name !== undefined && keep.has(node.name) ? node : undefined
}

// Narrow a tree to the active subtree filter. A filter that names exactly one
// clade's leaves descends into that clade (the monophyletic case, e.g. clicking
// an internal node); any other leaf set is pruned to those leaves with the
// topology preserved. Returns the original root when no filter is given or no
// kept leaf remains.
export function applySubtreeFilter(
  root: HierarchyNode<ClusterNodeData>,
  subtreeFilter: string[] | undefined,
): HierarchyNode<ClusterNodeData> {
  if (!subtreeFilter?.length) {
    return root
  }
  const filterSet = new Set(subtreeFilter)
  const monophyletic = findSubtree(root, filterSet)
  if (monophyletic) {
    return monophyletic
  }
  const pruned = pruneNewickToLeaves(
    root.data,
    filterSet,
    hasIncrementalBranchLengths(root),
  )
  return pruned ? hierarchy<ClusterNodeData>(pruned, d => d.children) : root
}

export function parseClusterTree(newick: string, subtreeFilter?: string[]) {
  return applySubtreeFilter(buildTree(newick), subtreeFilter)
}

// The row-side half of applySubtreeFilter: narrow a display's rows to the same
// filter the tree was narrowed to, so the dendrogram's leaves and the rows drawn
// beside it can't disagree about who survived. Every tree-sidebar consumer
// (multi-wiggle, multi-row features, MAF, multi-sample variants) needs this, and
// two rules are easy to get wrong per-plugin, so they live here:
//
//   - Keyed on `name`, never a per-plugin alias like `sampleName`: the filter
//     holds tree *leaf* names, and phased variant clustering makes those
//     haplotype names ("HG001 HP0") rather than sample names.
//   - Hide-only. Anything derived from a row's index in the full list (an index
//     palette color, a group color) must be computed before filtering, or
//     focusing a clade silently recolors the rows it kept.
//
// Returns the input array by reference when no filter is set, so callers can
// short-circuit on identity (same contract as reconcileLayout).
export function filterRowsBySubtree<T extends { name: string }>(
  rows: T[],
  subtreeFilter: readonly string[] | undefined,
): T[] {
  const filterSet = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  return filterSet ? rows.filter(r => filterSet.has(r.name)) : rows
}

// True when focusing this subtree would hide nothing: the node already contains
// every row on screen. The root always does, and clicking it is a natural "show
// me everything" gesture — which is exactly the click that must not go through,
// because applying that filter leaves the rows where they are while making
// "Clear subtree filter" appear as though something had changed. On MAF it is
// worse than cosmetic: `subtreeFilter` is a fetch argument and therefore an
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
// This is a *derived* check on purpose. `setLayout` clears a stale
// `clusterTree` for the writes that go through it, but rows also move without
// any layout write at all: a display decorating `sources` downstream of
// `layout` (multi-row features' `rowGroups` partition), a discovered row set
// growing as regions load (multi-row features, multi-wiggle), a phased
// expansion switching on when the ploidy arrives (multi-sample variants). One
// check where the tree is positioned covers all of them, and covers whatever
// the next one turns out to be.
export function treeDescribesRows(
  root: HierarchyNode<ClusterNodeData>,
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
// against on the name axis, on the pixel axis instead.
//
// It reads as an alias for `height` on a display that grows to its content (the
// multi-row feature display redefines `height` as exactly `nrow ×
// effectiveRowHeight`) or that is always fit-to-height (multi-wiggle). It is not
// one on a display that scrolls: maf passes `rowsContentHeight` and NOT
// `rowsHeight`, and the variant displays spell the product out. Changing a
// caller to the viewport height is the tidy-up this parameter is named to refuse.
export function computeClusterHierarchy(
  root: HierarchyNode<ClusterNodeData> | undefined,
  rows: readonly { name: string }[] | undefined,
  rowsContentHeight: number,
  treeAreaWidth: number,
  showBranchLength: boolean,
): ClusterHierarchyNode | undefined {
  return root && rows?.length && treeDescribesRows(root, rows)
    ? clusterLayout(root, rowsContentHeight, treeAreaWidth, showBranchLength)
    : undefined
}

// Parse pasted R hclust output (a sequence of 1-based row indices, one per
// line, with possible blank/whitespace lines) into a numeric array. Callers map
// these 1-based indices into their source list.
export function parseClusterOrder(paste: string): number[] {
  return paste
    .split('\n')
    .map(t => t.trim())
    .filter(f => !!f)
    .map(r => +r)
}

// A pasted order is only meaningful if it's a full permutation of the rows:
// buildClusteredLayout catches out-of-range indices, but a partial paste or one
// with duplicates would silently drop/duplicate subtracks. Throw a clear error
// instead. `order` is 0-based.
//
// "entry N" is the **position** in the paste, and the value is reported beside
// it. It used to be `${idx + 1}` alone, which reads like a position but is the
// value — and `parseClusterOrder` is a bare `+`, so a stray word in the paste
// arrives as NaN and printed as "entry NaN is out of range 1-40", naming
// neither. This is the only feedback the user gets on a 200-line paste, so it
// has to say where to look.
//
// Position, not line number: `parseClusterOrder` drops blank lines, so the two
// disagree on exactly the pastes most likely to be malformed.
export function validateClusterOrder(order: number[], length: number) {
  const seen = new Set<number>()
  for (const [i, idx] of order.entries()) {
    const at = `entry ${i + 1}`
    if (!Number.isInteger(idx)) {
      throw new Error(
        `Invalid clustering order: ${at} is not a whole number. Paste only the row numbers printed by cat(resultClusters$order), one per line`,
      )
    }
    if (idx < 0 || idx >= length) {
      throw new Error(
        `Invalid clustering order: ${at} is ${idx + 1}, outside the range 1-${length}`,
      )
    }
    if (seen.has(idx)) {
      throw new Error(`Invalid clustering order: ${at} repeats row ${idx + 1}`)
    }
    seen.add(idx)
  }
  if (order.length !== length) {
    throw new Error(
      `Invalid clustering order: expected ${length} entries, got ${order.length}`,
    )
  }
}

// Reconcile a persisted `layout` (user reorder/relabel/override) against the
// rows currently discovered in the data: keep layout order, drop layout rows no
// longer present, append newly-discovered rows in discovered order. Layout
// fields win on merge (they are the user's overrides). Empty layout returns the
// discovered array by reference, so callers can short-circuit on identity.
// Shared by every multi-row display's `sources`/`editableSources` getter so the
// membership rules can't drift. Layout entries are partial overrides keyed by
// `name`, so the discovered row supplies every field a layout entry omits.
export function reconcileLayout<D extends { name: string }>(
  discovered: D[],
  layout: (Partial<D> & { name: string })[],
): D[] {
  if (!layout.length) {
    return discovered
  }
  const byName = new Map(discovered.map(s => [s.name, s]))
  const laidOut = layout.flatMap(s => {
    const info = byName.get(s.name)
    return info ? [{ ...info, ...s }] : []
  })
  const inLayout = new Set(layout.map(s => s.name))
  const appended = discovered.filter(s => !inLayout.has(s.name))
  return [...laidOut, ...appended]
}

export function buildClusteredLayout<S extends { name: string }>(
  baseSources: S[],
  existingLayout: S[],
  order: number[],
): S[] {
  const existingByName = new Map(existingLayout.map(s => [s.name, s]))
  return order.map(idx => {
    const source = baseSources[idx]
    if (!source) {
      throw new Error(`cluster order index ${idx} out of bounds`)
    }
    const existing = existingByName.get(source.name)
    return existing ? { ...source, ...existing } : source
  })
}
