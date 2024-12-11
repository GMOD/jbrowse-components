/**
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-present, Jon Schlinkert.
 * Released under the MIT License.
 */

export function isNumber(num: unknown): num is number {
  if (typeof num === 'number') {
    return num - num === 0
  } else if (typeof num === 'string' && num.trim() !== '') {
    return Number.isFinite(+num)
  } else {
    return false
  }
}
