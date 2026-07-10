import { hierarchy, leaves, sum } from './hierarchy.ts'
import parseNewick from './newick.ts'

import type { HierarchyNode } from './hierarchy.ts'
import type { ClusterNodeData } from './types.ts'

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
  const data = parseNewick(newick)
  const root = hierarchy<ClusterNodeData>(data, d => d.children)
  sum(root, d => (d.children ? 0 : 1))
  return root
}

// Prune a Newick-shaped tree down to just the leaves in `keep`, preserving the
// topology among them. Internal nodes left with a single child are collapsed
// into that child (their branch length added on) so the result has no spurious
// unary nodes. Returns undefined if no kept leaf is below `node`.
//
// Unlike `findSubtree` (which only matches a single monophyletic clade), this
// works for any leaf set — e.g. a scattered hand-picked species selection — so
// the rendered dendrogram always matches the visible rows rather than falling
// back to the full tree.
export function pruneNewickToLeaves(
  node: ClusterNodeData,
  keep: Set<string>,
): ClusterNodeData | undefined {
  if (node.children?.length) {
    const children = node.children
      .map(c => pruneNewickToLeaves(c, keep))
      .filter((c): c is ClusterNodeData => c !== undefined)
    if (children.length === 0) {
      return undefined
    }
    if (children.length === 1) {
      const child = children[0]!
      return { ...child, length: (child.length ?? 0) + (node.length ?? 0) }
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
  const pruned = pruneNewickToLeaves(root.data, filterSet)
  if (!pruned) {
    return root
  }
  const filtered = hierarchy<ClusterNodeData>(pruned, d => d.children)
  sum(filtered, d => (d.children ? 0 : 1))
  return filtered
}

export function parseClusterTree(newick: string, subtreeFilter?: string[]) {
  return applySubtreeFilter(buildTree(newick), subtreeFilter)
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
