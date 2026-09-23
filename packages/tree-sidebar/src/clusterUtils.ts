import { parseNewick } from '@gmod/newick'

import {
  clusterLayout,
  eachAfter,
  hasIncrementalBranchLengths,
  hierarchy,
  leaves,
} from './hierarchy.ts'
import { rotateNewickByDomain } from './rotateNewickByDomain.ts'

import type { RowAlias } from './arrangeRows.ts'
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
  //
  // `eachAfter` rather than a recursive walk for the reason every traversal in
  // this package is iterative: a single-linkage dendrogram is a caterpillar
  // whose depth is its leaf count. It visits a node only after all of its
  // descendants, so the first match is still the deepest one — which is what
  // picks the clade itself over an ancestor that adds only unnamed leaves.
  const below = new Map<HierarchyNode<T>, { count: number; allIn: boolean }>()
  let found: HierarchyNode<T> | undefined
  eachAfter(root, (n: HierarchyNode<T>) => {
    if (n.children?.length) {
      let count = 0
      let allIn = true
      for (const child of n.children) {
        const r = below.get(child)!
        count += r.count
        if (!r.allIn) {
          allIn = false
        }
      }
      below.set(n, { count, allIn })
      if (!found && allIn && count === filterSet.size) {
        found = n
      }
    } else {
      const { name } = n.data
      below.set(
        n,
        name === undefined
          ? { count: 0, allIn: true }
          : { count: 1, allIn: filterSet.has(name) },
      )
    }
  })
  return found
}

// Parse a Newick string and build a hierarchy, without applying a filter.
// Kept separate from applySubtreeFilter so MST can cache them independently —
// changing the subtree filter re-runs only the traversal, not the parser.
//
// `domain` rotates the tree towards a declared leaf order
// (`rotateNewickByDomain`); empty leaves it as written.
export function buildTree(
  newick: string,
  domain: readonly string[] = [],
): HierarchyNode<ClusterNodeData> {
  return hierarchy<ClusterNodeData>(
    rotateNewickByDomain(parseNewick(newick), domain),
    d => d.children,
  )
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
  // Iterative post-order, on the raw newick data rather than a HierarchyNode:
  // build each node's replacement only once every child's is known. Recursion
  // here threw past ~5000 tips on the caterpillar this package exists to draw.
  const order: ClusterNodeData[] = []
  const stack = [node]
  while (stack.length > 0) {
    const n = stack.pop()!
    order.push(n)
    if (n.children) {
      for (const child of n.children) {
        stack.push(child)
      }
    }
  }
  const pruned = new Map<ClusterNodeData, ClusterNodeData | undefined>()
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i]!
    if (n.children?.length) {
      const children = n.children.flatMap(c => {
        const p = pruned.get(c)
        return p ? [p] : []
      })
      pruned.set(
        n,
        children.length === 0
          ? undefined
          : children.length === 1
            ? incrementalLengths
              ? {
                  ...children[0]!,
                  length: (children[0]!.length ?? 0) + (n.length ?? 0),
                }
              : children[0]!
            : { ...n, children },
      )
    } else {
      pruned.set(n, n.name !== undefined && keep.has(n.name) ? n : undefined)
    }
  }
  return pruned.get(node)
}

// Narrow a tree to the active subtree filter. A filter that names exactly one
// clade's leaves descends into that clade (the monophyletic case, e.g. clicking
// an internal node); any other leaf set is pruned to those leaves with the
// topology preserved. Returns the original root when no filter is given or no
// kept leaf remains.
export function applySubtreeFilter(
  root: HierarchyNode<ClusterNodeData>,
  subtreeFilter: readonly string[] | undefined,
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
// short-circuit on identity.
export function filterRowsBySubtree<T extends { name: string }>(
  rows: T[],
  subtreeFilter: readonly string[] | undefined,
): T[] {
  const filterSet = subtreeFilter?.length ? new Set(subtreeFilter) : undefined
  return filterSet ? rows.filter(r => filterSet.has(r.name)) : rows
}

/**
 * The rows a focus keeps: those `kept` names, in the order given. A focus
 * naming no current row keeps every row rather than none, so a stale focus
 * — one saved against rows that have since been renamed — never blanks the
 * display. Synthesis keyed to a row's place among every row runs before
 * this, for the reason {@link filterRowsBySubtree} states.
 *
 * With `rowAlias`, a name keeps every row answering to it, so a sample's name
 * keeps its haplotypes; and a row that is its own alias (a sample not yet
 * expanded) stands for the rows answering to it, so it is kept when any of
 * them is named. One `kept` then narrows the samples a fetch asks for and the
 * haplotype rows drawn alike.
 */
export function keptRows<T extends { name: string }>(
  rows: T[],
  kept: readonly string[] | undefined,
  rowAlias?: RowAlias,
): T[] {
  if (!rowAlias) {
    const focused = filterRowsBySubtree(rows, kept)
    return focused.length ? focused : rows
  }
  if (!kept?.length) {
    return rows
  }
  const samples = new Set(
    kept.flatMap(name => {
      const sample = rowAlias(name)
      return sample === undefined ? [] : [sample]
    }),
  )
  const ofSamples = rows.filter(row =>
    samples.has(rowAlias(row.name) ?? row.name),
  )
  if (!ofSamples.length) {
    return rows
  }
  const names = new Set(kept)
  const exact = ofSamples.filter(row => {
    const sample = rowAlias(row.name)
    return (
      sample === row.name ||
      names.has(row.name) ||
      (sample !== undefined && names.has(sample))
    )
  })
  return exact.length ? exact : ofSamples
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
// any layout write at all: a display decorating `sources` downstream of its
// order (multi-row features' `rowGroups` partition), a discovered row set
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

// Where `rows` first stops matching the row list the matrix was built over, as
// a phrase to put in an error, or undefined when the two agree.
function clusterRowDrift(
  rows: readonly { name: string }[],
  matrixRowNames: readonly string[],
) {
  for (let i = 0; i < Math.min(rows.length, matrixRowNames.length); i++) {
    if (rows[i]!.name !== matrixRowNames[i]) {
      return `row ${i + 1} was "${matrixRowNames[i]}" and is now "${rows[i]!.name}"`
    }
  }
  return rows.length === matrixRowNames.length
    ? undefined
    : `the matrix had ${matrixRowNames.length} rows and there are now ${rows.length}`
}

// A pasted order is only meaningful if it's a full permutation of the rows:
// buildClusteredLayout catches out-of-range indices, but a partial paste or one
// with duplicates would silently drop/duplicate subtracks. Throw a clear error
// instead. `order` is 0-based.
//
// **And a permutation of the SAME rows.** `matrixRowNames` is the row list the
// exported matrix was built over, which is the order `generateClusterRScript`
// wrote into `rownames` and so the order `resultClusters$order` indexes. The
// rows move underneath a dialog that stays open across a trip to R: a region
// finishing its load discovers a new partition value, a phased expansion
// switches on, a sample filter changes. A count alone passes every one of those
// that swaps one row for another, and the ranks then land on rows that never
// entered the matrix, silently and with a dendrogram that still draws. Omitted
// where there is no exported matrix to compare against; an order straight from
// the clustering RPC always covers the rows it was handed.
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
export function validateClusterOrder(
  order: number[],
  rows: readonly { name: string }[],
  matrixRowNames?: readonly string[],
) {
  const { length } = rows
  const drift = matrixRowNames && clusterRowDrift(rows, matrixRowNames)
  if (drift) {
    throw new Error(
      `Invalid clustering order: the rows changed since the matrix was generated (${drift}). Re-generate the R script and paste the order it prints`,
    )
  }
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

/**
 * A clustering run's `order` turned into the display's next row order — the
 * one write behind both the "Run clustering" RPC and a hand-pasted R order, on
 * every display that clusters its rows.
 *
 * `rows` is the row set the run CLUSTERED, and it is what the order indexes:
 * the same array whose names went to the worker. Under an active subtree filter
 * that is the focused clade, so a run resolves the structure WITHIN it rather
 * than handing back the whole-cohort tree — both the more useful answer and the
 * only one `computeClusterHierarchy` will draw, since it refuses a tree whose
 * leaves are not exactly the drawn rows in order.
 *
 * **Undecorated rows, not the drawn `sources`.** Every display decorates on the
 * way to the painting — multi-wiggle synthesizes a palette, the multi-row
 * feature display tags `rowGroups` colors and may reorder into blocks — and
 * the arrangement holds whatever it is handed, which is meant to be only what
 * the user chose. `editableSources` narrowed by the focus is the list, and it
 * already carries each row's own overrides.
 *
 * The rows the focus is hiding are re-appended rather than dropped: the
 * arrangement records every row's position and overrides, so losing them here
 * would erase them for good the moment the focus is cleared. They land after
 * the clustered block, which is a no-op with no focus active.
 *
 * `matrixRowNames` comes from the R-script path and names the rows the exported
 * matrix held, so a paste applied after the clustered rows moved (a filter
 * cleared, a guide tree arriving) is rejected rather than landing each rank on
 * its neighbour. The RPC path has none: its order came from the very array
 * passed here.
 */
export function clusteredCladeLayout<S extends { name: string }>({
  rows,
  editableSources,
  order,
  matrixRowNames,
}: {
  rows: S[]
  editableSources: S[]
  order: number[]
  matrixRowNames?: string[]
}): S[] {
  validateClusterOrder(order, rows, matrixRowNames)
  const clustered = buildClusteredLayout(rows, order)
  const clusteredNames = new Set(clustered.map(s => s.name))
  return [
    ...clustered,
    ...editableSources.filter(s => !clusteredNames.has(s.name)),
  ]
}

export function buildClusteredLayout<S extends { name: string }>(
  baseSources: S[],
  order: number[],
): S[] {
  return order.map(idx => {
    const source = baseSources[idx]
    if (!source) {
      throw new Error(`cluster order index ${idx} out of bounds`)
    }
    return source
  })
}
