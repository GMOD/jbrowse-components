import type { BaseAdapter } from './BaseAdapter'
import type { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter'
import type { BaseRefNameAliasAdapter } from './BaseRefNameAliasAdapter'
import type { BaseSequenceAdapter } from './BaseSequenceAdapter'
import type { BaseTextSearchAdapter } from './BaseTextSearchAdapter'
import type { RegionsAdapter } from './RegionsAdapter'

export type AnyDataAdapter =
  | BaseAdapter
  | BaseFeatureDataAdapter
  | BaseRefNameAliasAdapter
  | BaseTextSearchAdapter
  | RegionsAdapter
  | BaseSequenceAdapter

export function isSequenceAdapter(t: AnyDataAdapter): t is BaseSequenceAdapter {
  return 'getRegions' in t && 'getFeatures' in t
}

export function isRegionsAdapter(t: AnyDataAdapter): t is RegionsAdapter {
  return 'getRegions' in t
}

export function isFeatureAdapter(
  t: AnyDataAdapter,
): t is BaseFeatureDataAdapter {
  return 'getFeatures' in t
}

export function isRefNameAliasAdapter(t: object): t is BaseRefNameAliasAdapter {
  return 'getRefNameAliases' in t
}

export function isTextSearchAdapter(
  t: AnyDataAdapter,
): t is BaseTextSearchAdapter {
  return 'searchIndex' in t
}
