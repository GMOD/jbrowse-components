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
 * two instances, each reading its own, and an instance never changes reference
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
  return (
    adapterCache[cacheKey] ??
    storeWithEvict(
      cacheKey,
      getAdapterPre(
        pluginManager,
        sessionId,
        adapterConfigSnapshot,
        keyedSequence,
      ),
    )
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
 * actually taken it — whenever that is. Until @gmod/shared-read-cache 2.0 it
 * was worse than "whenever": the cache's idle sweep ran on a setInterval that
 * held the cache, a pending timer is a GC root, and so a cache nobody cleared
 * stayed reachable until that sweep emptied it three minutes later. Closing one
 * panned alignments track that way cost nothing that mattered: the worker fell
 * from 296 MB to 7 MB four minutes on. A run that opens and closes a track per
 * image does not have four minutes, and with the timer now holding its cache
 * weakly it still does not have a GC to wait for. `jb2export batch` drew a callset from CRAM slices of long reads at about a
 * record every two seconds, each record's adapters leaving a decoded slice
 * behind, and two of its four processes reached the 4 GB heap limit 135 s in
 * with the shared budget reporting 3,100 MB held against its 1,024 MB limit:
 * the budget leaves every cache its last entry, and there were 54 caches.
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
        cacheEntry.dataAdapter.freeResources()
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
