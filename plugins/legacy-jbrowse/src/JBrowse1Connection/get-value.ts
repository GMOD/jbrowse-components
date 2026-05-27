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

const isObject = (v: unknown) => v !== null && typeof v === 'object'

const join = (segs: string[], joinChar: string, options: Options): string => {
  if (typeof options.join === 'function') {
    return options.join(segs)
  }
  return segs[0] + joinChar + segs[1]
}

const split = (path: string, splitChar: string, options: Options): string[] => {
  if (typeof options.split === 'function') {
    return options.split(path)
  }
  return path.split(splitChar)
}

const isValid = (key: string, target: unknown, options: Options): boolean => {
  if (typeof options.isValid === 'function') {
    return options.isValid(key, target as {}) // eslint-disable-line
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

  let t = target as Record<string, unknown>

  if (t[path as string] !== undefined) {
    return isValid(path as string, t, options)
      ? t[path as string]
      : options.default
  }

  const segs = pathIsArray
    ? (path as string[])
    : split(path as string, splitChar, options)
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

    if (t[prop] !== undefined) {
      if (!isValid(prop, t, options)) {
        return options.default
      }
      t = t[prop] as Record<string, unknown>
    } else {
      let hasProp = false
      let n = idx + 1

      while (n < len) {
        prop = join([prop, segs[n++]!], joinChar, options)

        if ((hasProp = t[prop] !== undefined)) {
          if (!isValid(prop, t, options)) {
            return options.default
          }
          t = t[prop] as Record<string, unknown>
          idx = n - 1
          break
        }
      }

      if (!hasProp) {
        return options.default
      }
    }
  } while (++idx < len && isValidObject(t))

  if (idx === len) {
    return t
  }

  return options.default
}

export default getValue
