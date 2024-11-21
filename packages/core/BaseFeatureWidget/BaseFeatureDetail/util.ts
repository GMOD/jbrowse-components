import isObject from 'is-object'
import { max, measureText } from '../../util'
import { ellipses } from '../util'

export function isEmpty(obj: Record<string, unknown>) {
  return Object.keys(obj).length === 0
}

export function generateTitle(name: unknown, id: unknown, type: unknown) {
  return [ellipses(`${name || id || ''}`), `${type}`]
    .filter(f => !!f)
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
  arr.forEach(elt => {
    if (isObject(obj2)) {
      obj2 = obj2[elt]
    }
  })
  return typeof obj2 === 'string'
    ? obj2
    : isObject(obj2) && typeof obj2.Description === 'string'
      ? obj2.Description
      : undefined
}
