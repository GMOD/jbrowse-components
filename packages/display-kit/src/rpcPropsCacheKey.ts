import { adapterConfigKey } from '@jbrowse/core/util/adapterConfigKey'

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
 * `rpcProps` is looked up dynamically rather than declared on either mixin's
 * public interface, so subclasses keep their narrow return types through MST's
 * `.views()` chains.
 */
export function serializeRpcProps(
  self: IStateTreeNode & { rpcProps?: () => unknown },
) {
  const { rpcProps } = self
  return rpcProps ? JSON.stringify(rpcProps.call(self)) : ''
}

/**
 * The other non-viewport axis of a fetch, beside the settings above: the
 * adapter the fetch runs against, as `adapterConfigKey` spells it everywhere.
 * Reached through `FetchMixin.adapterConfigKey` and watched by the same two
 * readers as `rpcPropsCacheKey`, so a track re-pointed in the config editor
 * refetches on both LGV families the way it already did on the comparative
 * one. `adapterConfig` is `BaseDisplay`'s, looked up dynamically for the
 * reason `rpcProps` is; `''` for a node without one.
 */
export function serializeAdapterConfig(
  self: IStateTreeNode & { adapterConfig?: Record<string, unknown> },
) {
  const { adapterConfig } = self
  return adapterConfig ? adapterConfigKey(adapterConfig) : ''
}
