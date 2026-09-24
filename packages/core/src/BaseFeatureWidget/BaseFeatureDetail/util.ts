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

// pick using a path from an object, similar to _.get from lodash with special
// logic for Descriptions from e.g. VCF headers
//
// @param arr  example ['a','b'], obj = {a:{b:'hello}}
// @returns hello (with special addition to grab description also)
//
// A path that runs out of objects before it runs out of elements has no
// description: walking ['INFO','ANN'] into `{INFO: 'a string'}` used to stop at
// the string and hand it back, so every subfield of an object-valued attribute
// inherited its parent's description.
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
