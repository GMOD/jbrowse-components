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

/**
 * #api
 * The `adapterCapabilities` entry of an adapter that reads the reference
 * sequence of the assembly it is displayed against: BAM and SAM for mismatches
 * without an MD tag, CRAM to rebuild bases, GC content and the reference scans
 * for everything they answer. Such an adapter is built with that reference and
 * keyed on it as well as on its config, so one config shown on two genomes is
 * two instances, each reading the reference of its genome, and an instance never changes reference
 * for its life. Every other adapter keys on its config alone: a synteny adapter
 * is fetched from each of its assemblies and reads no reference.
 */
export const READS_REFERENCE = 'readsReference'

function readsReference(
  pluginManager: PluginManager,
  adapterConfig: ConfigSnap | undefined,
) {
  const type: unknown = adapterConfig?.type
  return (
    typeof type === 'string' &&
    pluginManager
      .getAdapterType(type)
      .adapterCapabilities.includes(READS_REFERENCE)
  )
}

interface AdapterCacheEntry {
  dataAdapter: AnyDataAdapter
  sessionIds: Set<string>
}

// Pruned by storeWithEvict (rejections) and by freeAdapterResources, which the
// CoreFreeResources RPC reaches when the last track holding an adapter config is
// closed (releaseAdapterSession). The browser sets no size bound: an adapter
// whose track stays open lives as long as its worker, by design. A host with no
// tracks to close bounds it with keepAdapters. Ordered least recently
// requested first.
let adapterCache = new Map<string, Promise<AdapterCacheEntry>>()
let requests = 0
const lastRequests = new WeakMap<AdapterCacheEntry, number>()

/** stores a promise in the cache and auto-evicts if it rejects */
function storeWithEvict(key: string, p: Promise<AdapterCacheEntry>) {
  p.catch(() => {
    if (adapterCache.get(key) === p) {
      adapterCache.delete(key)
    }
  })
  adapterCache.set(key, p)
  return p
}

async function getAdapterPre(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
  keyedSequence: Record<string, unknown> | undefined,
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

  // a sub-adapter reads the reference its parent was built with
  const getSubAdapter: getSubAdapterType = conf =>
    getAdapter(pluginManager, sessionId, conf, keyedSequence)
  const CLASS = await dataAdapterType.getAdapterClass()
  const dataAdapter = new CLASS(
    adapterConfig,
    getSubAdapter,
    pluginManager,
    keyedSequence,
  )

  return {
    dataAdapter,
    sessionIds: new Set([sessionId]),
  }
}

/**
 * look up the cached entry for a config, creating and storing it if absent.
 * Keyed synchronously, so concurrent callers share one pending entry
 */
function getOrCreateEntry(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  const keyedSequence =
    sequenceAdapter && readsReference(pluginManager, adapterConfigSnapshot)
      ? sequenceAdapter
      : undefined
  const configKey = adapterConfigCacheKey(adapterConfigSnapshot)
  const cacheKey = keyedSequence
    ? `${configKey}|${adapterConfigCacheKey(keyedSequence)}`
    : configKey
  const cached = adapterCache.get(cacheKey)
  if (cached) {
    adapterCache.delete(cacheKey)
    adapterCache.set(cacheKey, cached)
    return cached
  }
  return storeWithEvict(
    cacheKey,
    getAdapterPre(
      pluginManager,
      sessionId,
      adapterConfigSnapshot,
      keyedSequence,
    ),
  )
}

/**
 * instantiate a data adapter, or return a cached one with the same config.
 * `sequenceAdapter` is the reference of the genome the request names; a
 * {@link READS_REFERENCE} type is keyed on it and built with it, any other
 * type ignores it
 */
export async function getAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
  sequenceAdapter?: Record<string, unknown>,
): Promise<AdapterCacheEntry> {
  const ret = await getOrCreateEntry(
    pluginManager,
    sessionId,
    adapterConfigSnapshot,
    sequenceAdapter,
  )
  ret.sessionIds.add(sessionId)
  lastRequests.set(ret, ++requests)
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
 * Deleting the key makes the instance unreachable from here, and for most
 * adapters that is the whole reclamation: a parsed GFF3 goes with it.
 *
 * The indexed adapters are the exception, which is why an evicted adapter is
 * also told so (`freeResources`). @gmod/bam, @gmod/cram and @gmod/tabix each
 * hold their parsed chunks in a SharedReadCache charged to the shared budget,
 * and the budget credits a dropped cache back only once the collector has
 * taken it. A run that opens and closes a track per image has no GC to wait
 * for. `jb2export batch` drew a callset from CRAM slices of long reads at
 * about a record every two seconds, and before @gmod/shared-read-cache 2.1 two
 * of its four processes reached the 4 GB heap limit 135 s in, with the budget
 * at 3,100 MB against its 1,024 MB limit: the budget left each of 54 caches
 * its last entry. 2.1 keeps one entry per budget instead.
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
  for (const [cacheKey, cacheEntryP] of [...adapterCache]) {
    try {
      const cacheEntry = await cacheEntryP
      cacheEntry.sessionIds.delete(sessionId)
      if (cacheEntry.sessionIds.size === 0) {
        evict(cacheKey, cacheEntryP)
        cacheEntry.dataAdapter.freeResources()
      }
    } catch (e) {
      console.error(
        `dataAdapterCache: evicting failed adapter "${cacheKey}"`,
        e,
      )
      evict(cacheKey, cacheEntryP)
    }
  }
}

function evict(cacheKey: string, entry: Promise<AdapterCacheEntry>) {
  if (adapterCache.get(cacheKey) === entry) {
    adapterCache.delete(cacheKey)
  }
}

/** How many adapter requests the cache has answered. */
export function adapterRequests() {
  return requests
}

/**
 * Evict every cached adapter `keep` declines, each told to free what it holds,
 * whatever sessions claim it. `keep` sees the settled adapters most recently
 * requested first, each with the {@link adapterRequests} count at its latest
 * request. For a host with no tracks to close, such as `@jbrowse/tables`,
 * which would otherwise keep an adapter, its parsed index and its share of the
 * decoded-bytes budget for every file it ever read.
 */
export async function keepAdapters(
  keep: (dataAdapter: AnyDataAdapter, lastRequest: number) => boolean,
) {
  const cached = [...adapterCache].reverse()
  const settled = await Promise.all(
    cached.map(([, entry]) => entry.catch(() => undefined)),
  )
  cached.forEach(([cacheKey, entry], i) => {
    const adapter = settled[i]
    if (adapter && !keep(adapter.dataAdapter, lastRequests.get(adapter) ?? 0)) {
      evict(cacheKey, entry)
      adapter.dataAdapter.freeResources()
    }
  })
}

/** How many adapters the cache holds, failed and pending ones included. */
export function cachedAdapterCount() {
  return adapterCache.size
}

export function clearAdapterCache() {
  adapterCache = new Map()
}
