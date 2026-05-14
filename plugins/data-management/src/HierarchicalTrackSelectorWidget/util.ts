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

export function matches(
  query: string,
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
) {
  const categories = (readConfObject(conf, 'category') || []) as string[]
  const queryLower = query.trim().toLowerCase()
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    categories.some(c => c.toLowerCase().includes(queryLower))
  )
}

interface Node {
  children: Node[]
  id: string
}

export function findSubCategories(obj: Node[], paths: string[], depth = 0) {
  let hasSubs = false
  for (const elt of obj) {
    if (elt.children.length) {
      const hasSubCategories = findSubCategories(elt.children, paths, depth + 1)
      // avoid pushing the root "Tracks" node by checking depth>0
      if (hasSubCategories && depth > 0) {
        paths.push(elt.id)
      }
    } else {
      hasSubs = true
    }
  }
  return hasSubs
}

export function findTopLevelCategories(obj: Node[], paths: string[]) {
  for (const elt of obj) {
    if (elt.children.length) {
      paths.push(elt.id)
    }
  }
}

export function getAllTrackNodes(subtree?: TreeNode): TreeTrackNode[] {
  if (subtree?.type === 'category') {
    return subtree.children.flatMap(t =>
      t.type === 'category' ? getAllTrackNodes(t) : [t],
    )
  }
  return []
}
