import NonError from './nonError.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyErrorConstructor = new (...args: any[]) => Error

const errorConstructors = new Map<string, AnyErrorConstructor>([
  ['Error', Error],
  ['EvalError', EvalError],
  ['RangeError', RangeError],
  ['ReferenceError', ReferenceError],
  ['SyntaxError', SyntaxError],
  ['TypeError', TypeError],
  ['URIError', URIError],
  ['AggregateError', AggregateError],
])

const errorProperties = [
  { property: 'name', enumerable: false },
  { property: 'message', enumerable: false },
  { property: 'stack', enumerable: false },
  { property: 'code', enumerable: true },
  { property: 'cause', enumerable: false },
  { property: 'errors', enumerable: false },
] as const

const toJsonWasCalled = new WeakSet()

function toJSON(from: { toJSON: () => unknown }) {
  toJsonWasCalled.add(from)
  const json = from.toJSON()
  toJsonWasCalled.delete(from)
  return json
}

function newError(name: string) {
  const ErrorConstructor = errorConstructors.get(name) ?? Error
  if (name === 'AggregateError') {
    return new AggregateError([])
  }
  return new ErrorConstructor()
}

export function isErrorLike(value: unknown): value is Error {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Error).name === 'string' &&
    typeof (value as Error).message === 'string' &&
    typeof (value as Error).stack === 'string'
  )
}

function isMinimumViableSerializedError(
  value: unknown,
): value is { name: string; message: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { message?: unknown }).message === 'string' &&
    !Array.isArray(value)
  )
}

interface DestroyCircularOptions {
  from: Record<string, unknown>
  seen: unknown[]
  to?: Record<string, unknown> | Error | unknown[]
  forceEnumerable?: boolean
  maxDepth: number
  depth: number
  useToJSON?: boolean
  serialize: boolean
}

function destroyCircular({
  from,
  seen,
  to,
  forceEnumerable,
  maxDepth,
  depth,
  useToJSON,
  serialize,
}: DestroyCircularOptions): Record<string, unknown> {
  if (!to) {
    if (Array.isArray(from)) {
      to = []
    } else if (!serialize && isErrorLike(from)) {
      to = newError(from.name)
    } else {
      to = {}
    }
  }

  seen.push(from)

  if (depth >= maxDepth) {
    return to as Record<string, unknown>
  }

  if (
    useToJSON &&
    typeof (from as { toJSON?: unknown }).toJSON === 'function' &&
    !toJsonWasCalled.has(from)
  ) {
    return toJSON(from as { toJSON: () => unknown }) as Record<string, unknown>
  }

  const continueDestroyCircular = (value: Record<string, unknown>) =>
    destroyCircular({
      from: value,
      seen: [...seen],
      forceEnumerable,
      maxDepth,
      depth,
      useToJSON,
      serialize,
    })

  for (const [key, value] of Object.entries(from)) {
    if (
      value &&
      value instanceof Uint8Array &&
      value.constructor.name === 'Buffer'
    ) {
      ;(to as Record<string, unknown>)[key] = serialize
        ? '[object Buffer]'
        : value
      continue
    }

    if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as { pipe?: unknown }).pipe === 'function'
    ) {
      ;(to as Record<string, unknown>)[key] = serialize
        ? '[object Stream]'
        : value
      continue
    }

    if (typeof value === 'function') {
      if (!serialize) {
        ;(to as Record<string, unknown>)[key] = value
      }
      continue
    }

    if (!value || typeof value !== 'object') {
      try {
        ;(to as Record<string, unknown>)[key] = value
      } catch {}
      continue
    }

    if (!seen.includes(from[key])) {
      depth++
      ;(to as Record<string, unknown>)[key] = continueDestroyCircular(
        from[key] as Record<string, unknown>,
      )
      continue
    }

    ;(to as Record<string, unknown>)[key] = '[Circular]'
  }

  if (serialize || to instanceof Error) {
    for (const { property, enumerable } of errorProperties) {
      const val = from[property]
      if (val !== undefined && val !== null) {
        Object.defineProperty(to, property, {
          value:
            isErrorLike(val) || Array.isArray(val)
              ? continueDestroyCircular(
                  val as unknown as Record<string, unknown>,
                )
              : val,
          enumerable: forceEnumerable ? true : enumerable,
          configurable: true,
          writable: true,
        })
      }
    }
  }

  return to as Record<string, unknown>
}

export interface ErrorObject {
  name?: string
  message: string
  stack?: string
  code?: string
  cause?: unknown
}

export function serializeError(
  value: unknown,
  options: { maxDepth?: number; useToJSON?: boolean } = {},
) {
  const { maxDepth = Number.POSITIVE_INFINITY, useToJSON = true } = options

  if (typeof value === 'object' && value !== null) {
    return destroyCircular({
      from: value as Record<string, unknown>,
      seen: [],
      forceEnumerable: true,
      maxDepth,
      depth: 0,
      useToJSON,
      serialize: true,
    }) as unknown as ErrorObject
  }

  let normalized: unknown = value
  if (typeof value === 'function') {
    normalized = '<Function>'
  }

  return destroyCircular({
    from: new NonError(normalized) as unknown as Record<string, unknown>,
    seen: [],
    forceEnumerable: true,
    maxDepth,
    depth: 0,
    useToJSON,
    serialize: true,
  }) as unknown as ErrorObject
}

export function deserializeError(
  value: unknown,
  options: { maxDepth?: number } = {},
) {
  const { maxDepth = Number.POSITIVE_INFINITY } = options

  if (value instanceof Error) {
    return value
  }

  if (isMinimumViableSerializedError(value)) {
    return destroyCircular({
      from: value as unknown as Record<string, unknown>,
      seen: [],
      to: newError((value as { name?: string }).name ?? 'Error'),
      maxDepth,
      depth: 0,
      serialize: false,
    }) as unknown as Error
  }

  return new NonError(value)
}
