import idMaker from '../util/idMaker.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyDataAdapter } from './BaseAdapter/index.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

type ConfigSnap = SnapshotIn<AnyConfigurationSchemaType>

export function adapterConfigCacheKey(conf: Record<string, unknown> = {}) {
  const { adapterId } = conf
  return typeof adapterId === 'string' && adapterId ? adapterId : idMaker(conf)
}

interface AdapterCacheEntry {
  dataAdapter: AnyDataAdapter
  sessionIds: Set<string>
}

// Pruned by storeWithEvict (rejections) and by freeAdapterResources, which the
// CoreFreeResources RPC reaches when the last track holding an adapter config is
// closed (releaseAdapterSession). There is still no size bound: an adapter
// whose track stays open lives as long as its worker, by design.
let adapterCache: Record<string, Promise<AdapterCacheEntry>> = {}

/** stores a promise in the cache and auto-evicts if it rejects */
function storeWithEvict(key: string, p: Promise<AdapterCacheEntry>) {
  p.catch(() => {
    delete adapterCache[key]
  })
  adapterCache[key] = p
  return p
}

async function getAdapterPre(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
) {
  const adapterType = adapterConfigSnapshot?.type

  if (!adapterType) {
    throw new Error(
      `could not determine adapter type from adapter config snapshot ${JSON.stringify(
        adapterConfigSnapshot,
      )}`,
    )
  }
  const dataAdapterType = pluginManager.getAdapterType(adapterType)

  // instantiate the data adapter's config schema so it gets its defaults,
  // callbacks, etc
  const adapterConfig = dataAdapterType.configSchema.create(
    adapterConfigSnapshot,
    { pluginManager },
  )

  const getSubAdapter: getSubAdapterType = conf =>
    getAdapter(pluginManager, sessionId, conf)
  const CLASS = await dataAdapterType.getAdapterClass()
  const dataAdapter = new CLASS(adapterConfig, getSubAdapter, pluginManager)

  return {
    dataAdapter,
    sessionIds: new Set([sessionId]),
  }
}

/** look up the cached entry for a config, creating and storing it if absent */
function getOrCreateEntry(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
) {
  const cacheKey = adapterConfigCacheKey(adapterConfigSnapshot)
  return (
    adapterCache[cacheKey] ??
    storeWithEvict(
      cacheKey,
      getAdapterPre(pluginManager, sessionId, adapterConfigSnapshot),
    )
  )
}

/** instantiate a data adapter, or return a cached one with the same config */
export async function getAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
): Promise<AdapterCacheEntry> {
  const ret = await getOrCreateEntry(
    pluginManager,
    sessionId,
    adapterConfigSnapshot,
  )
  ret.sessionIds.add(sessionId)
  return ret
}

/**
 * this is a callback that is passed to adapters that allows them to get any
 * sub-adapters that they need internally, staying with the same worker session
 * ID
 */
export type getSubAdapterType = (
  adapterConfigSnap: ConfigSnap,
) => ReturnType<typeof getAdapter>

/**
 * Drop this session's claim on every cached adapter, and evict the ones no
 * other session still claims. Reached from the CoreFreeResources RPC when the
 * last track using an adapter config closes.
 *
 * Deleting the key is the whole reclamation: the cache is the only strong
 * reference to an adapter, so once it goes the instance and everything it holds
 * — a whole parsed GFF3, a BAM chunk cache — become unreachable and are
 * collected normally. There is nothing to free by hand.
 *
 * "Collected normally" is not the same as "collected now", and for the indexed
 * adapters it is not even soon. @gmod/bam, @gmod/cram and @gmod/tabix each hold
 * their parsed chunks in a SharedReadCache that sweeps itself on a setInterval,
 * and a pending timer is a GC root — so the instance stays reachable through its
 * own sweep timer until that sweep empties the cache and stops itself, three
 * minutes later. Measured: closing a panned alignments track reclaims nothing at
 * the time it happens, and the worker falls from 296 MB to 7 MB four minutes on.
 * Deleting the key is still the only thing to do here; just don't read a heap
 * immediately after a close and conclude this did nothing.
 *
 * The refcount is what makes this safe to call on any track close: an adapter
 * pulled in as a sub-adapter carries its parent's sessionId (getSubAdapter
 * passes it straight through), so a sequence adapter shared by two alignments
 * tracks survives either one of them closing.
 */
export async function freeAdapterResources(args: { sessionId?: string }) {
  const { sessionId } = args
  if (!sessionId) {
    return
  }
  for (const [cacheKey, cacheEntryP] of Object.entries(adapterCache)) {
    try {
      const cacheEntry = await cacheEntryP
      cacheEntry.sessionIds.delete(sessionId)
      if (cacheEntry.sessionIds.size === 0) {
        delete adapterCache[cacheKey]
      }
    } catch (e) {
      console.error(
        `dataAdapterCache: evicting failed adapter "${cacheKey}"`,
        e,
      )
      delete adapterCache[cacheKey]
    }
  }
}

export function clearAdapterCache() {
  adapterCache = {}
}
