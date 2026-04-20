import { fromNewick } from '@gmod/hclust'

import { cluster, hierarchy } from './d3-hierarchy2/index.ts'

import type { ClusterHierarchyNode } from './types.ts'

export function getLeafNames(node: ClusterHierarchyNode): string[] {
  if (!node.children?.length) {
    return [node.data.name]
  }
  return node.children.flatMap(child => getLeafNames(child))
}

function findSubtree(
  node: ClusterHierarchyNode,
  filterSet: Set<string>,
): ClusterHierarchyNode | undefined {
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
  const tree = fromNewick(newick)
  let root = hierarchy(tree, (d: ClusterHierarchyNode) => d.children)
    .sum((d: ClusterHierarchyNode) => (d.children ? 0 : 1))
    .sort(
      (a: ClusterHierarchyNode, b: ClusterHierarchyNode) =>
        (a.data.height || 1) - (b.data.height || 1),
    )

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

export function computeHierarchyLayout(
  root: ClusterHierarchyNode,
  layoutHeight: number,
  layoutWidth: number,
) {
  cluster()
    .size([layoutHeight, layoutWidth])
    .separation(() => 1)(root)
  return root
}
