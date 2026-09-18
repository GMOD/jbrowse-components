import { isObservable, toJS } from 'mobx'

import { stableIdentityComputed } from './stableIdentityComputed.ts'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The two tiers of a per-region fetch's inputs, as **values**. `isDataCurrent`
 * compares them structurally, so a display states each input once — in the
 * object it sends the worker — instead of once there and once again in a key.
 *
 * Two tiers and not one, because the tiers differ in what a change *shows*:
 * `settings` raises `staleSettingsDrawn`'s scrim over the held data, `zoom`
 * deliberately does not. Everything else about them is the same question.
 */
export interface FetchInputs {
  settings: unknown
  zoom: unknown
}

/**
 * The host members {@link makeSettingsFetchInputs} reads, looked up
 * dynamically rather than declared on `FetchMixin`'s public interface, so a
 * subclass keeps its narrow `rpcProps()` return type through MST's `.views()`
 * chain.
 */
export interface SettingsFetchInputsHost extends IStateTreeNode {
  rpcProps?: () => unknown
  adapterConfig?: Record<string, unknown>
}

/**
 * The host members {@link makeFetchInputs} reads beyond the settings tier.
 */
export interface FetchInputsHost extends IStateTreeNode {
  settingsFetchInputs: unknown
  /**
   * The zoom-derived worker arguments as an object — **the same object the
   * display spreads into its RPC call**, which is the whole point of the hook:
   * a display that sends `bpPerPx` and keys on `String(bpPerPx)` has written
   * one fact twice, and the two spellings drift.
   *
   * Alignments fills it with its per-base bin and detail tier, canvas with
   * its resolved glyph mode and peptide flag. A display whose worker reads no
   * zoom leaves it undefined, and its zoom tier never moves.
   */
  zoomFetchArgs?: () => object
}

/**
 * A fetch input as a value that cannot change behind the stamp.
 *
 * The stamp outlives the fetch that wrote it, so a field holding a live
 * collection — MAF's `subtreeFilter: self.subtreeFilterSet`, a display handing
 * over an MST array — is mutated in place inside every stamp, and the
 * staleness compare then reads the current state against itself and says
 * nothing moved.
 *
 * Plain objects, arrays and observable containers are rebuilt; a `Set` or `Map`
 * becomes its entry list, which changes what the compare sees but changes it
 * the same way on both sides. Everything else — primitives, `Date`, typed
 * arrays, class instances — is carried by reference, so a class instance
 * mutated in place is the one hazard left, and `compareStructural` walks its
 * own fields either way.
 */
export function snapshotInputs(value: unknown): unknown {
  const v: unknown = isObservable(value) ? toJS(value) : value
  if (v === null || typeof v !== 'object') {
    return v
  }
  if (Array.isArray(v)) {
    return Object.freeze(v.map(snapshotInputs))
  }
  if (v instanceof Set) {
    return Object.freeze([...v].map(snapshotInputs))
  }
  if (v instanceof Map) {
    return Object.freeze([...v].map(entry => snapshotInputs(entry)))
  }
  if (Object.getPrototypeOf(v) !== Object.prototype) {
    return v
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(v).map(([k, field]) => [k, snapshotInputs(field)]),
    ),
  )
}

/**
 * Every fetch family's settings axis: the `rpcProps()` payload and the adapter
 * config, as one structural computed.
 *
 * Structural, so the value's identity survives a recomputation that lands on
 * the same content — every stamp holds the *same* object, and the freshness
 * compare then short-circuits on `===`.
 *
 * Structural also settles two hazards a serialized key cannot. `JSON.stringify`
 * drops an `undefined`-valued key, so a field could not be told from a sibling
 * state that also drops; and it flattens a class with no own enumerable fields
 * to `{}`. `compareStructural` counts keys and compares own fields, so a change
 * to either state invalidates.
 */
export function makeSettingsFetchInputs(self: SettingsFetchInputsHost) {
  return stableIdentityComputed(() =>
    snapshotInputs({
      rpcProps: self.rpcProps?.call(self),
      adapterConfig: self.adapterConfig,
    }),
  )
}

/**
 * A per-region fetch's `settings` and `zoom` tiers as one structural computed,
 * the settings half read off the host's `settingsFetchInputs`.
 */
export function makeFetchInputs(self: FetchInputsHost) {
  const zoom = stableIdentityComputed(() =>
    snapshotInputs(self.zoomFetchArgs?.call(self)),
  )
  return stableIdentityComputed((): FetchInputs => ({
    settings: self.settingsFetchInputs,
    zoom: zoom.get(),
  }))
}
