import { errorConstructors, errorFactories } from './errorConstructors.ts'
import NonError from './nonError.ts'

export interface ErrorObject {
  name?: string
  message: string
  stack?: string
  code?: string
  cause?: unknown
}

const errorProperties: { property: string; enumerable: boolean }[] = [
  { property: 'name', enumerable: false },
  { property: 'message', enumerable: false },
  { property: 'stack', enumerable: false },
  { property: 'code', enumerable: true },
  { property: 'cause', enumerable: false },
  { property: 'errors', enumerable: false },
]

const toJsonWasCalled = new WeakSet()

function toJSON(from: Record<string, unknown>) {
  toJsonWasCalled.add(from)
  const json = (from as { toJSON: () => unknown }).toJSON()
  toJsonWasCalled.delete(from)
  return json
}

function newError(name: string) {
  const factory = errorFactories.get(name)
  if (factory) {
    return factory()
  }
  const ErrorConstructor = errorConstructors.get(name) ?? Error
  if (name === 'AggregateError') {
    return new AggregateError([], 'AggregateError')
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

function isMinimumViableSerializedError(value: unknown): value is ErrorObject {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ErrorObject).message === 'string' &&
    !Array.isArray(value)
  )
}

interface DestroyCircularOpts {
  from: Record<string, unknown>
  seen: unknown[]
  to?: Record<string, unknown>
  forceEnumerable?: boolean
  maxDepth: number
  depth: number
  useToJSON?: boolean
  serialize?: boolean
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
}: DestroyCircularOpts): Record<string, unknown> {
  if (!to) {
    if (Array.isArray(from)) {
      to = [] as unknown as Record<string, unknown>
    } else if (!serialize && isErrorLike(from)) {
      to = newError((from as Error).name) as unknown as Record<string, unknown>
    } else {
      to = {}
    }
  }

  seen.push(from)

  if (depth >= maxDepth) {
    return to
  }

  if (
    useToJSON &&
    typeof (from as { toJSON?: unknown }).toJSON === 'function' &&
    !toJsonWasCalled.has(from)
  ) {
    return toJSON(from) as Record<string, unknown>
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
      to[key] = serialize ? '[object Buffer]' : value
      continue
    }

    if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as { pipe?: unknown }).pipe === 'function'
    ) {
      to[key] = serialize ? '[object Stream]' : value
      continue
    }

    if (typeof value === 'function') {
      if (!serialize) {
        to[key] = value
      }
      continue
    }

    if (!value || typeof value !== 'object') {
      try {
        to[key] = value
      } catch {
        // ignore
      }
      continue
    }

    if (!seen.includes(from[key])) {
      depth++
      to[key] = continueDestroyCircular(from[key] as Record<string, unknown>)
      continue
    }

    to[key] = '[Circular]'
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

  return to
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
      to: newError(value.name ?? 'Error') as unknown as Record<string, unknown>,
      maxDepth,
      depth: 0,
      serialize: false,
    }) as unknown as Error
  }

  return new NonError(value)
}
