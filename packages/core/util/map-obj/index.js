// this is vendored from v6.0.0 of https://github.com/sindresorhus/map-obj/ (MIT)
const isObject = value => typeof value === 'object' && value !== null

// Check if a value is a plain object that should be recursed into
const isObjectCustom = value => {
  if (!isObject(value)) {
    return false
  }

  // Exclude built-in objects
  if (
    value instanceof RegExp ||
    value instanceof Error ||
    value instanceof Date ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    value instanceof Promise ||
    value instanceof ArrayBuffer ||
    value instanceof DataView ||
    ArrayBuffer.isView(value) || // Typed arrays
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (globalThis.Blob && value instanceof globalThis.Blob)
  ) {
    return false
  }

  // Exclude Jest matchers
  if (
    typeof value.$$typeof === 'symbol' ||
    typeof value.asymmetricMatch === 'function'
  ) {
    return false
  }

  return true
}

export const mapObjectSkip = Symbol('mapObjectSkip')

const getEnumerableKeys = (object, includeSymbols) => {
  if (includeSymbols) {
    const stringKeys = Object.keys(object)
    const symbolKeys = Object.getOwnPropertySymbols(object).filter(
      symbol => Object.getOwnPropertyDescriptor(object, symbol)?.enumerable,
    )
    return [...stringKeys, ...symbolKeys]
  }

  return Object.keys(object)
}

const _mapObject = (object, mapper, options, isSeen = new WeakMap()) => {
  const { target = {}, ...processOptions } = {
    deep: false,
    includeSymbols: false,
    ...options,
  }

  if (isSeen.has(object)) {
    return isSeen.get(object)
  }

  isSeen.set(object, target)

  const mapArray = array =>
    array.map(element =>
      isObjectCustom(element)
        ? _mapObject(element, mapper, processOptions, isSeen)
        : element,
    )

  if (Array.isArray(object)) {
    return mapArray(object)
  }

  for (const key of getEnumerableKeys(object, processOptions.includeSymbols)) {
    const value = object[key]
    const mapResult = mapper(key, value)

    if (mapResult === mapObjectSkip) {
      continue
    }

    if (!Array.isArray(mapResult)) {
      throw new TypeError(
        `Mapper must return an array or mapObjectSkip, got ${mapResult === null ? 'null' : typeof mapResult}`,
      )
    }

    if (mapResult.length < 2) {
      throw new TypeError(
        `Mapper must return an array with at least 2 elements [key, value], got ${mapResult.length} elements`,
      )
    }

    let [newKey, newValue, { shouldRecurse = true } = {}] = mapResult

    // Drop `__proto__` keys.
    if (newKey === '__proto__') {
      continue
    }

    if (processOptions.deep && shouldRecurse && isObjectCustom(newValue)) {
      newValue = Array.isArray(newValue)
        ? mapArray(newValue)
        : _mapObject(newValue, mapper, processOptions, isSeen)
    }

    try {
      target[newKey] = newValue
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('read only')) {
        // Skip non-configurable properties
        continue
      }

      throw error
    }
  }

  return target
}

export default function mapObject(object, mapper, options) {
  if (!isObject(object)) {
    throw new TypeError(
      `Expected an object, got \`${object}\` (${typeof object})`,
    )
  }

  if (Array.isArray(object)) {
    throw new TypeError('Expected an object, got an array')
  }

  // Ensure the third mapper argument is always the original input object
  const mapperWithRoot = (key, value) => mapper(key, value, object)

  return _mapObject(object, mapperWithRoot, options)
}
