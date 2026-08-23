import { getType } from '@jbrowse/mobx-state-tree'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The RPC cache key both display families invalidate on: the display's
 * `rpcProps()` payload serialized to a string. Reached through one getter,
 * `FetchMixin.rpcPropsCacheKey` — watched by `SettingsInvalidate` per-region and
 * by the fetch autorun's trigger list globally. `''` for a display with no
 * `rpcProps`.
 *
 * A string, because building the payload reads far more observables than it
 * returns and because a fresh object never compares equal. The corollary that
 * bites: a field whose distinct states serialize identically is a silently dead
 * cache axis — a class instance with no `toJSON` flattens to `{}`, and an
 * `undefined` value drops its key, so it can't be told from a sibling state that
 * also drops. Worked cases and the loop-trap consequence: ARCHITECTURE.md "the
 * cache key is the return value, not the reads".
 *
 * The first of those is checkable and is checked: in development the payload
 * is walked once per display and any value `JSON.stringify` would misrepresent
 * is reported with its path. The `undefined` case is not detectable from one
 * payload, so it stays a rule.
 *
 * `rpcProps` is looked up dynamically rather than declared on either mixin's
 * public interface, so subclasses keep their narrow return types through MST's
 * `.views()` chains.
 */
export function serializeRpcProps(
  self: IStateTreeNode & { rpcProps?: () => unknown },
) {
  const { rpcProps } = self
  return rpcProps ? serialize(self, rpcProps.call(self)) : ''
}

function serialize(self: IStateTreeNode, payload: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    reportUnserializableRpcProps(self, payload)
  }
  return JSON.stringify(payload)
}

const reported = new WeakSet<object>()

function reportUnserializableRpcProps(self: IStateTreeNode, payload: unknown) {
  if (!reported.has(self)) {
    const offenders = findUnserializable(payload, 'rpcProps()')
    if (offenders.length > 0) {
      reported.add(self)
      console.error(
        `[jbrowse display contract] ${getType(self).name}: \`rpcProps()\` ` +
          `returns a value JSON.stringify cannot represent, so changing it ` +
          `never refetches (a silently dead cache axis): ` +
          `${offenders.join(', ')}. Return primitives, plain arrays and ` +
          `plain objects, or give the class a \`toJSON\`.`,
      )
    }
  }
}

/**
 * Paths at which `JSON.stringify` would drop or flatten `value`: functions,
 * and any object that is neither a plain object nor an array and has no
 * `toJSON` — a `Map`, a `Set`, a typed array, a class instance. An MST node
 * has `toJSON` (its snapshot), and so does `SerializableFilterChain`.
 */
export function findUnserializable(value: unknown, path: string): string[] {
  return typeof value === 'function'
    ? [`${path} (function)`]
    : typeof value !== 'object' || value === null || hasToJSON(value)
      ? []
      : Array.isArray(value)
        ? value.flatMap((v, i) => findUnserializable(v, `${path}[${i}]`))
        : isPlainObject(value)
          ? Object.entries(value).flatMap(([k, v]) =>
              findUnserializable(v, `${path}.${k}`),
            )
          : [`${path} (${value.constructor.name || 'object'} without toJSON)`]
}

function hasToJSON(value: object) {
  return 'toJSON' in value && typeof value.toJSON === 'function'
}

function isPlainObject(value: object) {
  const proto: object | null = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}
