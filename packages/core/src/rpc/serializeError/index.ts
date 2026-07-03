export interface ErrorObject {
  name: string
  message: string
  stack?: string
  cause?: unknown
  [key: string]: unknown
}

// Error's core fields (name/message/stack) are non-enumerable, so they're
// copied explicitly; `cause` is non-enumerable too and recursed separately. Any
// other own-enumerable props (AuthNeededError.url, a Node-style .code, etc.) are
// copied generically so custom error data survives the worker boundary.
const coreProperties = new Set(['name', 'message', 'stack', 'cause'])

function stringify(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

function isSerializedError(value: unknown): value is ErrorObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as ErrorObject).message === 'string'
  )
}

function errorToObject(error: Error, seen: Set<unknown>): ErrorObject {
  const obj: ErrorObject = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  }
  // copy custom own-enumerable data (url, code, ...); skip functions since they
  // aren't structured-cloneable and postMessage would throw on them
  for (const [key, value] of Object.entries(error)) {
    if (!coreProperties.has(key) && typeof value !== 'function') {
      obj[key] = value
    }
  }
  const { cause } = error
  if (cause !== undefined && !seen.has(cause)) {
    seen.add(cause)
    obj.cause = cause instanceof Error ? errorToObject(cause, seen) : cause
  }
  return obj
}

export function serializeError(value: unknown): ErrorObject {
  if (value instanceof Error) {
    return errorToObject(value, new Set([value]))
  }
  // a thrown non-Error value (string, object, ...) still travels as an Error so
  // the other side can reject with something error-shaped
  return { name: 'NonError', message: stringify(value) }
}

export function deserializeError(value: unknown): Error {
  if (value instanceof Error) {
    return value
  }
  if (typeof value === 'string') {
    return new Error(value)
  }
  if (isSerializedError(value)) {
    // reconstructed as a plain Error carrying the original name (nothing in the
    // app branches on `instanceof TypeError` etc. across the worker boundary)
    const error = new Error(value.message) as Error & Record<string, unknown>
    error.name = value.name ?? 'Error'
    if (value.stack) {
      error.stack = value.stack
    }
    for (const [key, val] of Object.entries(value)) {
      if (!coreProperties.has(key)) {
        error[key] = val
      }
    }
    if (value.cause !== undefined) {
      error.cause = isSerializedError(value.cause)
        ? deserializeError(value.cause)
        : value.cause
    }
    return error
  }
  return new Error(stringify(value))
}
