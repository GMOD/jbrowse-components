import { isObject, max, measureText } from '../../util/index.ts'
import { ellipses } from '../util.tsx'

export function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

// The view the details panel renders: raw feature fields with the
// formatDetails-callback output (`__jbrowsefmt`) merged on top, so a callback
// value overrides the raw one. A field the callback sets to null/undefined then
// drops out of the panel's `!= null` filters — this is how callbacks hide
// fields. `__jbrowsefmt` itself is in Attributes' globalOmit, so it never
// renders.
export function applyFeatureFormatting<
  T extends { __jbrowsefmt?: Record<string, unknown> },
>(feature: T) {
  return { ...feature, ...feature.__jbrowsefmt }
}

export function generateTitle(name: unknown, id: unknown, type: unknown) {
  const label = name || id
  return [label ? ellipses(`${label}`) : '', type ? `${type}` : '']
    .filter(Boolean)
    .join(' - ')
}

export function generateMaxWidth(array: unknown[][], prefix: string[]) {
  return (
    Math.ceil(
      max(array.map(key => measureText([...prefix, key[0]].join('.'), 12))),
    ) + 10
  )
}

// pick using a path from an object, similar to _.get from lodash with special
// logic for Descriptions from e.g. VCF headers
//
// @param arr  example ['a','b'], obj = {a:{b:'hello}}
// @returns hello (with special addition to grab description also)
export function accessNested(arr: string[], obj: Record<string, unknown> = {}) {
  let obj2: unknown = obj
  for (const elt of arr) {
    if (isObject(obj2)) {
      obj2 = obj2[elt]
    }
  }
  return typeof obj2 === 'string'
    ? obj2
    : isObject(obj2) && typeof obj2.Description === 'string'
      ? obj2.Description
      : undefined
}
