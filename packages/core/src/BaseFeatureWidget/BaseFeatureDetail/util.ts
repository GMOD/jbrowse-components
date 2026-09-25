import { coarseStripHTML, isObject } from '../../util/index.ts'
import { ellipses } from '../util.tsx'

export function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export function generateTitle(name: unknown, id: unknown, type: unknown) {
  const label = coarseStripHTML(`${name || id || ''}`)
  return [label ? ellipses(label) : '', type ? `${type}` : '']
    .filter(Boolean)
    .join(' - ')
}

// the description at `arr` in a descriptions tree: a string there, or the
// `Description` of the object there, as a VCF header entry carries. A path
// that runs out of objects early has none
export function accessNested(arr: string[], obj: Record<string, unknown> = {}) {
  let obj2: unknown = obj
  for (const elt of arr) {
    obj2 = isObject(obj2) ? obj2[elt] : undefined
  }
  return typeof obj2 === 'string'
    ? obj2
    : isObject(obj2) && typeof obj2.Description === 'string'
      ? obj2.Description
      : undefined
}
