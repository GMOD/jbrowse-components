/* !
 * get-value <https://github.com/jonschlinkert/get-value>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Released under the MIT License.
 */

export interface Options {
  default?: unknown
  separator?: string
  joinChar?: string
  join?: (segs: string[]) => string
  split?: (path: string) => string[]
  isValid?: (key: string, target: {}) => boolean // eslint-disable-line
}
// @ts-expect-error
const isObject = v => v !== null && typeof v === 'object'

const join = (segs: string[], joinChar: string, options: unknown): string => {
  // @ts-expect-error
  if (typeof options.join === 'function') {
    // @ts-expect-error
    return options.join(segs)
  }
  return segs[0] + joinChar + segs[1]
}

const split = (path: string, splitChar: string, options: unknown): string[] => {
  // @ts-expect-error
  if (typeof options.split === 'function') {
    // @ts-expect-error
    return options.split(path)
  }

  return path.split(splitChar)
}

const isValid = (
  key: string,
  target: unknown = {},
  options: unknown,
): boolean => {
  // @ts-expect-error
  if (typeof options?.isValid === 'function') {
    // @ts-expect-error
    return options.isValid(key, target)
  }

  return true
}

const isValidObject = (v: unknown): boolean => {
  return isObject(v) || typeof v === 'function'
}

const getValue = (
  target: unknown,
  path: string | number | string[],
  options: Options = {},
): unknown => {
  if (!isObject(options)) {
    options = { default: options }
  }

  if (!isValidObject(target)) {
    return options.default !== undefined ? options.default : target
  }

  if (typeof path === 'number') {
    path = String(path)
  }

  const pathIsArray = Array.isArray(path)
  const pathIsString = typeof path === 'string'
  const splitChar = options.separator || '.'
  const joinChar =
    options.joinChar || (typeof splitChar === 'string' ? splitChar : '.')

  if (!pathIsString && !pathIsArray) {
    return target
  }

  // @ts-expect-error
  if (target[path] !== undefined) {
    // @ts-expect-error
    return isValid(path, target, options) ? target[path] : options.default
  }

  // @ts-expect-error
  const segs = pathIsArray ? path : split(path, splitChar, options)
  const len = segs.length
  let idx = 0

  do {
    let prop = segs[idx]
    if (typeof prop !== 'string') {
      prop = String(prop)
    }

    while (prop.endsWith('\\')) {
      prop = join([prop.slice(0, -1), segs[++idx] || ''], joinChar, options)
    }

    // @ts-expect-error
    if (target[prop] !== undefined) {
      if (!isValid(prop, target, options)) {
        return options.default
      }

      // @ts-expect-error
      target = target[prop]
    } else {
      let hasProp = false
      let n = idx + 1

      while (n < len) {
        // @ts-expect-error
        prop = join([prop, segs[n++]], joinChar, options)

        // @ts-expect-error
        if ((hasProp = target[prop] !== undefined)) {
          if (!isValid(prop, target, options)) {
            return options.default
          }

          // @ts-expect-error
          target = target[prop]
          idx = n - 1
          break
        }
      }

      if (!hasProp) {
        return options.default
      }
    }
  } while (++idx < len && isValidObject(target))

  if (idx === len) {
    return target
  }

  return options.default
}

export default getValue
