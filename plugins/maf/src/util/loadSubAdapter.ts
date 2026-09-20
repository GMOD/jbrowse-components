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
 * BigMafAdapter and MafTabixAdapter each read their alignment file through a
 * sub-adapter (BigBed / BedTabix), whose config they state from their own
 * location slots.
 *
 * Memoizing it, and labelling the download, is `cachedSetup`'s — each adapter
 * holds one of those as its `configure` field.
 */
export async function loadSubAdapter<
  T extends BaseFeatureDataAdapter = BaseFeatureDataAdapter,
>(
  self: BaseFeatureDataAdapter,
  subAdapterConfig: Record<string, unknown>,
): Promise<{ adapter: T }> {
  if (!self.getSubAdapter) {
    throw new Error('no getSubAdapter available')
  }
  const result = await self.getSubAdapter(subAdapterConfig)
  return { adapter: result.dataAdapter as T }
}
