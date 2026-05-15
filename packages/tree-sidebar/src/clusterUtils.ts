import { hierarchy, sort, sum } from './hierarchy.ts'
import parseNewick from './newick.ts'

import type { HierarchyNode } from './hierarchy.ts'
import type { ClusterNodeData } from './types.ts'

export function getLeafNames<T extends ClusterNodeData>(
  node: HierarchyNode<T>,
): string[] {
  const result: string[] = []
  const stack: HierarchyNode<T>[] = [node]
  while (stack.length) {
    const n = stack.pop()!
    if (n.children?.length) {
      for (const child of n.children) {
        stack.push(child)
      }
    } else if (n.data.name !== undefined) {
      result.push(n.data.name)
    }
  }
  return result
}

function findSubtree<T extends ClusterNodeData>(
  node: HierarchyNode<T>,
  filterSet: Set<string>,
): HierarchyNode<T> | undefined {
  const leafNames = getLeafNames(node)
  if (
    leafNames.length === filterSet.size &&
    leafNames.every(name => filterSet.has(name))
  ) {
    return node
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findSubtree(child, filterSet)
      if (found) {
        return found
      }
    }
  }
  return undefined
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
