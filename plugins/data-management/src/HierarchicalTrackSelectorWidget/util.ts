import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type { TreeNode, TreeTrackNode } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function hasAnyOverlap<T>(a1: T[] = [], a2: T[] = []) {
  if (a1[0] !== undefined && a1[0] === a2[0]) {
    return true
  }
  const s1 = new Set(a1)
  return a2.some(a => s1.has(a))
}

export function hasAllOverlap<T>(a1: T[] = [], a2: T[] = []) {
  const s1 = new Set(a1)
  return a2.every(a => s1.has(a))
}

export function matches(
  query: string,
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
) {
  const categories = (readConfObject(conf, 'category') ?? []) as string[]
  const queryLower = query.toLowerCase()
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    categories.some(c => c.toLowerCase().includes(queryLower))
  )
}

export function matchesMetadata(query: string, conf: AnyConfigurationModel) {
  const queryLower = query.toLowerCase()
  const description = (readConfObject(conf, 'description') ?? '') as string
  const metadata = (readConfObject(conf, 'metadata') ?? {}) as Record<
    string,
    unknown
  >
  return (
    description.toLowerCase().includes(queryLower) ||
    Object.values(metadata).some(
      v =>
        v !== null &&
        v !== undefined &&
        `${v}`.toLowerCase().includes(queryLower),
    )
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
  if (subtree?.type === 'category') {
    return subtree.children.flatMap(t =>
      t.type === 'category' ? getAllTrackNodes(t) : [t],
    )
  }
  return []
}
