import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { TreeCategoryNode, TreeTrackNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}

// true if the two arrays share at least one element (symmetric)
export function intersects<T>(a: T[] = [], b: T[] = []) {
  const s = new Set(a)
  return b.some(x => s.has(x))
}

// true if `superset` contains every element of `subset`; argument order matters
export function containsAll<T>(superset: T[] = [], subset: T[] = []) {
  const s = new Set(superset)
  return subset.every(x => s.has(x))
}

// queryLower must be pre-lowercased by caller to avoid redundant per-track work
export function matchesLower(
  queryLower: string,
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
) {
  const categories =
    (readConfObject(conf, 'category') as string[] | undefined) ?? []
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    categories.some(c => c.toLowerCase().includes(queryLower))
  )
}

interface Node {
  children: Node[]
  id: string
}

// Collects IDs of category nodes (depth > 0) that have at least one direct
// leaf child — i.e. subcategories that contain tracks, not just more folders.
export function findSubCategories(obj: Node[]) {
  const paths: string[] = []
  function collect(nodes: Node[], depth: number) {
    for (const node of nodes) {
      if (node.children.length) {
        if (depth > 0 && node.children.some(c => !c.children.length)) {
          paths.push(node.id)
        }
        collect(node.children, depth + 1)
      }
    }
  }
  collect(obj, 0)
  return paths
}

export function findTopLevelCategories(obj: Node[]) {
  const paths: string[] = []
  for (const elt of obj) {
    if (elt.children.length) {
      paths.push(elt.id)
    }
  }
  return paths
}

export function getAllSubcategories(node: TreeCategoryNode): string[] {
  const categoryIds: string[] = []
  const stack = [node] as TreeCategoryNode[]
  while (stack.length > 0) {
    const curr = stack.pop()!
    for (const child of curr.children) {
      if (child.type === 'category') {
        categoryIds.push(child.id)
        stack.push(child)
      }
    }
  }
  return categoryIds
}

export function getAllTrackNodes(subtree: TreeCategoryNode): TreeTrackNode[] {
  const result: TreeTrackNode[] = []
  function collect(node: TreeCategoryNode) {
    for (const child of node.children) {
      if (child.type === 'track') {
        result.push(child)
      } else {
        collect(child)
      }
    }
  }
  collect(subtree)
  return result
}
