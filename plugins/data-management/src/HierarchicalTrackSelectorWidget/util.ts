import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function hasAnyOverlap<T>(a1: T[] = [], a2: T[] = []) {
  // shortcut case is that arrays are single entries, and are equal
  // long case is that we use a set
  if (a1[0] === a2[0]) {
    return true
  } else {
    const s1 = new Set(a1)
    return a2.some(a => s1.has(a))
  }
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
  const queryLower = query.toLowerCase()
  return (
    getTrackName(conf, session).toLowerCase().includes(queryLower) ||
    !!categories.filter(c => c.toLowerCase().includes(queryLower)).length
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
