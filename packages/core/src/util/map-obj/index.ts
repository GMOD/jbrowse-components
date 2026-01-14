// this is vendored from v6.0.0 of https://github.com/sindresorhus/map-obj/ (MIT)

export const mapObjectSkip: unique symbol = Symbol('mapObjectSkip')

export interface Options {
  readonly deep?: boolean
  readonly includeSymbols?: boolean
  readonly target?: Record<string | symbol, unknown>
}

export interface MapperOptions {
  readonly shouldRecurse?: boolean
}

type MapperResult<K extends string | symbol, V> =
  | [targetKey: K, targetValue: V, mapperOptions?: MapperOptions]
  | typeof mapObjectSkip

export type Mapper<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
> = (
  sourceKey: string,
  sourceValue: unknown,
  source: SourceObjectType,
) => MapperResult<MappedObjectKeyType, MappedObjectValueType>

const isObject = (value: unknown): value is Record<string | symbol, unknown> =>
  typeof value === 'object' && value !== null

const isObjectCustom = (
  value: unknown,
): value is Record<string | symbol, unknown> => {
  if (!isObject(value)) {
    return false
  }

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
    ArrayBuffer.isView(value) ||
    (globalThis.Blob && value instanceof globalThis.Blob)
  ) {
    return false
  }

  // Exclude Jest matchers
  const v = value as { $$typeof?: unknown; asymmetricMatch?: unknown }
  if (
    typeof v.$$typeof === 'symbol' ||
    typeof v.asymmetricMatch === 'function'
  ) {
    return false
  }

  return true
}

const getEnumerableKeys = (
  object: Record<string | symbol, unknown>,
  includeSymbols: boolean,
): (string | symbol)[] => {
  if (includeSymbols) {
    const stringKeys = Object.keys(object)
    const symbolKeys = Object.getOwnPropertySymbols(object).filter(
      symbol => Object.getOwnPropertyDescriptor(object, symbol)?.enumerable,
    )
    return [...stringKeys, ...symbolKeys]
  }

  return Object.keys(object)
}

interface ProcessOptions {
  deep: boolean
  includeSymbols: boolean
}

const _mapObject = <
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  object: SourceObjectType | unknown[],
  mapper: Mapper<SourceObjectType, MappedObjectKeyType, MappedObjectValueType>,
  options: Options | undefined,
  isSeen: WeakMap<object, unknown> = new WeakMap(),
): Record<MappedObjectKeyType, MappedObjectValueType> | unknown[] => {
  const { target = {}, deep = false, includeSymbols = false } = options ?? {}
  const processOptions: ProcessOptions = { deep, includeSymbols }

  if (isSeen.has(object as object)) {
    return isSeen.get(object as object) as Record<
      MappedObjectKeyType,
      MappedObjectValueType
    >
  }

  isSeen.set(object as object, target)

  const mapArray = (array: unknown[]): unknown[] =>
    array.map(element =>
      isObjectCustom(element)
        ? _mapObject(
            element as SourceObjectType,
            mapper,
            processOptions,
            isSeen,
          )
        : element,
    )

  if (Array.isArray(object)) {
    return mapArray(object)
  }

  for (const key of getEnumerableKeys(object, processOptions.includeSymbols)) {
    const value = object[key]
    const mapResult = mapper(key as string, value, object)

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
      newValue = (
        Array.isArray(newValue)
          ? mapArray(newValue)
          : _mapObject(
              newValue as SourceObjectType,
              mapper,
              processOptions,
              isSeen,
            )
      ) as MappedObjectValueType
    }

    try {
      ;(target as Record<string | symbol, unknown>)[newKey] = newValue
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('read only')) {
        continue
      }
      throw error
    }
  }

  return target as Record<MappedObjectKeyType, MappedObjectValueType>
}

export default function mapObject<
  SourceObjectType extends Record<string | symbol, unknown>,
  MappedObjectKeyType extends string | symbol,
  MappedObjectValueType,
>(
  object: SourceObjectType,
  mapper: Mapper<SourceObjectType, MappedObjectKeyType, MappedObjectValueType>,
  options?: Options,
): Record<MappedObjectKeyType, MappedObjectValueType> {
  if (!isObject(object)) {
    throw new TypeError(
      `Expected an object, got \`${object}\` (${typeof object})`,
    )
  }

  if (Array.isArray(object)) {
    throw new TypeError('Expected an object, got an array')
  }

  const mapperWithRoot: Mapper<
    SourceObjectType,
    MappedObjectKeyType,
    MappedObjectValueType
  > = (key, value) => mapper(key, value, object)

  return _mapObject(object, mapperWithRoot, options) as Record<
    MappedObjectKeyType,
    MappedObjectValueType
  >
}
