import { coarseStripHTML, isObject } from '../../util/index.ts'

function ellipses(slug: string) {
  return slug.length > 20 ? `${slug.slice(0, 20)}...` : slug
}

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

// the value at `path` in a feature, with a one-element array read as its
// element, as a details row draws it
export function valueAt(path: string[], obj: Record<string, unknown>) {
  let value: unknown = obj
  for (const elt of path) {
    value = isObject(value) ? value[elt] : undefined
  }
  return Array.isArray(value) ? onlyElement(value) : value
}

function onlyElement(arr: readonly unknown[]) {
  return arr.length === 1 ? arr[0] : arr
}
