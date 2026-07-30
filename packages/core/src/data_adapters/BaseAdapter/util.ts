import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter.ts'
import type { BaseRefNameAliasAdapter } from './BaseRefNameAliasAdapter.ts'
import type { BaseSequenceAdapter } from './BaseSequenceAdapter.ts'
import type { BaseTextSearchAdapter } from './BaseTextSearchAdapter.ts'
import type { RegionsAdapter } from './RegionsAdapter.ts'

export type AnyDataAdapter =
  | BaseAdapter
  | BaseFeatureDataAdapter
  | BaseRefNameAliasAdapter
  | BaseTextSearchAdapter
  | RegionsAdapter
  | BaseSequenceAdapter

// the minimum an adapter must expose for refName renaming to work against it
export interface RefNameSource {
  getRefNames(opts?: Record<string, unknown>): Promise<string[]>
}

export function isRegionsAdapter(t: AnyDataAdapter): t is RegionsAdapter {
  return 'getRegions' in t
}

export function isFeatureAdapter(
  t: AnyDataAdapter,
): t is BaseFeatureDataAdapter {
  return 'getFeatures' in t
}

// An adapter that can report the refNames its file uses, which is all refName
// renaming needs. Deliberately broader than isFeatureAdapter: an adapter can
// serve a non-feature payload (precomputed LD pairs, say) and still need its
// contig names reconciled with the assembly's. Gating refName lookup on
// isFeatureAdapter instead meant such an adapter reported *zero* refNames, so
// the refName map came back empty, so renaming silently did nothing and every
// record was later dropped on an exact-match refName test - a blank track with
// no error. See CoreGetRefNames.
export function isRefNameSource(
  t: AnyDataAdapter,
): t is AnyDataAdapter & RefNameSource {
  return typeof (t as Partial<RefNameSource>).getRefNames === 'function'
}

export function isSequenceAdapter(t: AnyDataAdapter): t is BaseSequenceAdapter {
  return 'getSequence' in t
}

export function isRefNameAliasAdapter(t: object): t is BaseRefNameAliasAdapter {
  return 'getRefNameAliases' in t
}

export function isTextSearchAdapter(
  t: AnyDataAdapter,
): t is BaseTextSearchAdapter {
  return 'searchIndex' in t
}
