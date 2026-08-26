import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * The type of a `cachedSetup` wrapping `loadSubAdapter`.
 *
 * Written out rather than inferred because the setup closure passes `this`, so
 * inferring the field's type would need the class's own type, which is what is
 * being inferred — TS7022. Every adapter holding one annotates it with this.
 */
export type SubAdapterLoader = (
  opts?: BaseOptions,
) => Promise<{ adapter: BaseFeatureDataAdapter }>

/**
 * BigMafAdapter and MafTabixAdapter both wrap a sub-adapter (BigBed /
 * BedTabix) and need identical "snapshot config → swap type → typecast"
 * plumbing. This is the single source of truth.
 *
 * Memoizing it, and labelling the download, is `cachedSetup`'s — each adapter
 * holds one of those as its `configure` field.
 */
export async function loadSubAdapter<
  T extends BaseFeatureDataAdapter = BaseFeatureDataAdapter,
>(self: BaseFeatureDataAdapter, subType: string): Promise<{ adapter: T }> {
  if (!self.getSubAdapter) {
    throw new Error('no getSubAdapter available')
  }
  const result = await self.getSubAdapter({
    ...getSnapshot(self.config),
    type: subType,
  })
  return { adapter: result.dataAdapter as T }
}
