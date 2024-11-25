import getValue from 'get-value'
import type { Track, Source } from './types'

export function isTrack(arg: any): arg is Track {
  return arg?.label && typeof arg.label === 'string'
}

export function isSource(arg: any): arg is Source {
  return arg?.url && typeof arg.url === 'string'
}

/**
 * updates a with values from b, recursively
 */

type Obj = Record<string, any>
export function deepUpdate(a: Obj, b: Obj): Obj {
  for (const prop of Object.keys(b)) {
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
    if (fillWith.callback) {
      // @ts-expect-error
      const v = fillWith.callback.call(this, varName)
      if (v !== undefined) {
        return v
      }
    }
    return match
  })
}

/**
 * Clones objects (including DOM nodes) and all children.
 * Warning: do not clone cyclic structures
 * (Lifted from dojo https://github.com/dojo/dojo/blob/master/_base/lang.js)
 * @param src - The object to clone
 */

export function clone(src: any): any {
  if (
    !src ||
    typeof src !== 'object' ||
    Object.prototype.toString.call(src) === '[object Function]'
  ) {
    // null, undefined, any non-object, or function
    return src // anything
  }
  if (src.nodeType && 'cloneNode' in src) {
    // DOM Node
    return src.cloneNode(true) // Node
  }
  if (src instanceof Date) {
    // Date
    return new Date(src.getTime()) // Date
  }
  if (src instanceof RegExp) {
    // RegExp
    return new RegExp(src) // RegExp
  }
  let r: unknown[]
  if (Array.isArray(src)) {
    // array
    r = []
    for (let i = 0, l = src.length; i < l; ++i) {
      if (i in src) {
        r[i] = clone(src[i])
      }
    }
    // we don't clone functions for performance reasons
    //    }else if(d.isFunction(src)){
    //      // function
    //      r = function(){ return src.apply(this, arguments); };
  } else {
    // generic objects
    r = src.constructor ? new src.constructor() : {}
  }
  return mixin(r, src, clone)
}

/**
 * Copies/adds all properties of source to dest; returns dest.
 * (Lifted from dojo https://github.com/dojo/dojo/blob/master/_base/lang.js)
 *
 * All properties, including functions (sometimes termed "methods"), excluding
 * any non-standard extensions found in Object.prototype, are copied/added to
 * dest. Copying/adding each particular property is delegated to copyFunc
 * (if any); copyFunc defaults to the Javascript assignment operator if not
 * provided. Notice that by default, mixin executes a so-called "shallow copy"
 * and aggregate types are copied/added by reference.
 * @param dest - The object to which to copy/add all properties contained in
 * source.
 * @param source - The object from which to draw all properties to copy into dest.
 * @param copyFunc - The process used to copy/add a property in source; defaults
 * to the Javascript assignment operator.
 * @returns dest, as modified
 */
function mixin(
  dest: Obj,
  source: Obj,
  copyFunc?: (arg: unknown) => unknown,
): Obj {
  const empty = {}
  for (const name in source) {
    // the (!(name in empty) || empty[name] !== s) condition avoids copying
    // properties in "source" inherited from Object.prototype.	 For example,
    // if dest has a custom toString() method, don't overwrite it with the
    // toString() method that source inherited from Object.prototype
    const s = source[name]
    if (
      !(name in dest) ||
      // @ts-expect-error
      (dest[name] !== s && (!(name in empty) || empty[name] !== s))
    ) {
      dest[name] = copyFunc ? copyFunc(s) : s
    }
  }

  return dest // Object
}
