import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'

/**
 * A source that reads only the lanes it is asked about answers a different
 * refName set per selection, so each selection loads its own map; the worker
 * keeps each lane's names, so a second selection reads only its new lanes.
 */
export function refNameMapKey(
  adapterConf: Record<string, unknown>,
  options: BaseOptions,
) {
  const key = adapterConfigCacheKey(adapterConf)
  return options.haplotypes === undefined
    ? key
    : `${key}|${[...options.haplotypes].sort().join(',')}`
}
