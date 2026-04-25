import { fromNewick } from '@gmod/hclust'

import { hierarchy, sort, sum } from './hierarchy.ts'

import type { HierarchyNode } from './hierarchy.ts'
import type { ClusterNodeData } from './types.ts'

export function getLeafNames(node: HierarchyNode<ClusterNodeData>): string[] {
  const result: string[] = []
  const stack: HierarchyNode<ClusterNodeData>[] = [node]
  while (stack.length) {
    const n = stack.pop()!
    if (n.children?.length) {
      for (const child of n.children) {
        stack.push(child)
      }
    } else {
      result.push(n.data.name)
    }
  }
  return result
}

function findSubtree(
  node: HierarchyNode<ClusterNodeData>,
  filterSet: Set<string>,
): HierarchyNode<ClusterNodeData> | undefined {
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

export function parseClusterTree(newick: string, subtreeFilter?: string[]) {
  let root = hierarchy<ClusterNodeData>(fromNewick(newick), d => d.children)
  sum(root, d => (d.children ? 0 : 1))
  sort(root, (a, b) => (a.data.height || 1) - (b.data.height || 1))

  if (subtreeFilter?.length) {
    const filterSet = new Set(subtreeFilter)
    const subtree = findSubtree(root, filterSet)
    if (subtree) {
      root = subtree
    }
  }
  return root
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
