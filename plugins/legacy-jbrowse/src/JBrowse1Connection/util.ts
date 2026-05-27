import getValue from './get-value.ts'

import type { Source, Track } from './types.ts'

export function isTrack(arg: unknown): arg is Track {
  const a = arg as Track | undefined
  return !!a?.label && typeof a.label === 'string'
}

export function isSource(arg: unknown): arg is Source {
  const a = arg as Source | undefined
  return !!a?.url && typeof a.url === 'string'
}

type Obj = Record<string, any>

export function deepUpdate(a: Obj, b: Obj): Obj {
  for (const prop of Object.keys(b)) {
    if (
      prop === '__proto__' ||
      prop === 'constructor' ||
      prop === 'prototype'
    ) {
      continue
    }
    if (
      prop in a &&
      typeof b[prop] === 'object' &&
      typeof a[prop] === 'object'
    ) {
      deepUpdate(a[prop], b[prop])
    } else if (a[prop] === undefined || b[prop] !== undefined) {
      a[prop] = b[prop]
    }
  }
  return a
}

/**
 * replace variables in a template string with values
 *
 * @param template - String with variable names in curly brackets
 * e.g., `http://foo/{bar}?arg={baz.foo}`
 * @param fillWith - object with attribute-value mappings
 * e.g., `{ 'bar': 'someurl', 'baz': { 'foo': 42 } }`
 * @returns the template string with variables in fillWith replaced
 * e.g., 'htp://foo/someurl?arg=valueforbaz'
 */
export function fillTemplate(template: string, fillWith: Obj): string {
  return template.replaceAll(/{([\s\w.]+)}/g, (match, varName) => {
    varName = varName.replaceAll(/\s+/g, '')
    const fill = getValue(fillWith, varName)
    if (fill !== undefined) {
      return typeof fill === 'function' ? fill(varName) : fill
    }
    return match
  })
}
