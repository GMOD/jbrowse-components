import { hierarchy, leaves, sort, sum } from './hierarchy.ts'
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

/**
 * Wrap a pre-parsed Newick-shaped tree in a HierarchyNode, sort children by
 * branch length, and (optionally) descend into the deepest subtree whose
 * leaves exactly match `subtreeFilter`. Use when you already hold the parsed
 * tree (e.g. an MST volatile); use `parseClusterTree(string, filter)` to
 * accept a Newick string directly.
 */
export function clusterTree<T extends ClusterNodeData>(
  data: T,
  subtreeFilter?: string[],
) {
  let root = hierarchy<T>(data, d => d.children as T[] | undefined)
  sum(root, d => (d.children ? 0 : 1))
  sort(root, (a, b) => (a.data.length ?? 1) - (b.data.length ?? 1))

  if (subtreeFilter?.length) {
    const filterSet = new Set(subtreeFilter)
    const subtree = findSubtree(root, filterSet)
    if (subtree) {
      root = subtree
    }
  }
  return root
}

export function parseClusterTree(newick: string, subtreeFilter?: string[]) {
  return clusterTree(parseNewick(newick), subtreeFilter)
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
