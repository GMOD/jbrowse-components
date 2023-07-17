import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'

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
