import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { TreeNode, TreeTrackNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function hasAnyOverlap<T>(a1: T[] = [], a2: T[] = []) {
  const s = new Set(a1)
  return a2.some(a => s.has(a))
}

export function hasAllOverlap<T>(a1: T[] = [], a2: T[] = []) {
  const s1 = new Set(a1)
  return a2.every(a => s1.has(a))
}

// queryLower must be pre-lowercased by caller to avoid redundant per-track work
export function matchesLower(
  queryLower: string,
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
) {
  const categories = (readConfObject(conf, 'category') as string[] | undefined) ?? []
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    categories.some(c => c.toLowerCase().includes(queryLower))
  )
}

interface Node {
  children: Node[]
  id: string
}

function findSubCategoriesInner(
  obj: Node[],
  depth: number,
): [paths: string[], hasDirectLeaves: boolean] {
  const paths: string[] = []
  let hasDirectLeaves = false
  for (const elt of obj) {
    if (elt.children.length) {
      const [subPaths, subHasDirectLeaves] = findSubCategoriesInner(
        elt.children,
        depth + 1,
      )
      // avoid pushing the root "Tracks" node by checking depth>0
      if (subHasDirectLeaves && depth > 0) {
        paths.push(elt.id)
      }
      for (const p of subPaths) {
        paths.push(p)
      }
    } else {
      hasDirectLeaves = true
    }
  }
  return [paths, hasDirectLeaves]
}

export function findSubCategories(obj: Node[]) {
  return findSubCategoriesInner(obj, 0)[0]
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

export function getAllTrackNodes(subtree?: TreeNode): TreeTrackNode[] {
  const result: TreeTrackNode[] = []
  function collect(node: TreeNode) {
    for (const child of node.children) {
      if (child.type === 'track') {
        result.push(child)
      } else {
        collect(child)
      }
    }
  }
  if (subtree?.type === 'category') {
    collect(subtree)
  }
  return result
}
