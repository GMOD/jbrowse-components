const isNonErrorSymbol = Symbol('isNonError')

function stringify(value: unknown) {
  if (value === undefined) {
    return 'undefined'
  }

  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'bigint') {
    return `${value}n`
  }

  if (typeof value === 'symbol') {
    return value.toString()
  }

  if (typeof value === 'function') {
    return `[Function${value.name ? ` ${value.name}` : ' (anonymous)'}]`
  }

  if (value instanceof Error) {
    try {
      return String(value)
    } catch {
      return '<Unserializable error>'
    }
  }

  try {
    return JSON.stringify(value)
  } catch {
    try {
      return String(value)
    } catch {
      return '<Unserializable value>'
    }
  }
}

export default class NonError extends Error {
  value: unknown

  constructor(value: unknown) {
    if (NonError.isNonError(value)) {
      return value
    }

    if (value instanceof Error) {
      throw new TypeError(
        'Do not pass Error instances to NonError. Throw the error directly instead.',
      )
    }

    super(`Non-error value: ${stringify(value)}`)

    Object.defineProperties(this, {
      name: { value: 'NonError' },
      [isNonErrorSymbol]: { value: true },
      isNonError: { value: true },
      value: { value },
    })
  }

  static isNonError(value: unknown): value is NonError {
    return (
      !!value &&
      typeof value === 'object' &&
      (value as Record<string | symbol, unknown>)[isNonErrorSymbol] === true
    )
  }

  static [Symbol.hasInstance](instance: unknown) {
    return NonError.isNonError(instance)
  }
}
