import { fingerprintAdapterConfig } from './adapterConfigFingerprint.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyDataAdapter } from './BaseAdapter/index.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

type ConfigSnap = SnapshotIn<AnyConfigurationSchemaType>

function adapterIdentity(conf: Record<string, unknown>) {
  const { adapterId } = conf
  return typeof adapterId === 'string' && adapterId
    ? { key: adapterId, credentials: '' }
    : fingerprintAdapterConfig(conf)
}

export function adapterConfigCacheKey(conf: Record<string, unknown>) {
  return adapterIdentity(conf).key
}

/**
 * #api
 * `conf` with its key stamped in as `adapterId`, so the worker reads it rather
 * than hashing the config on every call. For code that builds a large inline
 * config, such as a FromConfigAdapter's `features`.
 */
export function withAdapterId<T extends Record<string, unknown>>(conf: T) {
  return { ...conf, adapterId: fingerprintAdapterConfig(conf).key }
}

/**
 * #api
 * The `adapterCapabilities` entry of an adapter that reads the reference
 * sequence of the assembly it is displayed against: BAM and SAM for mismatches
 * without an MD tag, CRAM to rebuild bases, GC content and the reference scans
 * for everything they answer. Such an adapter is built with that reference and
 * keyed on it as well as on its config, so one config shown on two genomes is
 * two instances, each reading the reference of its genome, and an instance
 * never changes reference for its life. Every other adapter keys on its config
 * alone: a synteny adapter is fetched from each of its assemblies and reads no
 * reference.
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

/**
 * One built instance, as the parent of the sub-adapters it fetches: they are
 * claimed under `claim`, which is released when this instance is evicted. An
 * evicted instance still answering a request claims nothing more.
 */
interface Owner {
  claim: string
  evicted: boolean
}

interface CachedAdapter {
  adapter: Promise<AnyDataAdapter>
  credentials: string
  sessionIds: Set<string>
  lastRequest: number
  owner: Owner
}

// The browser sets no size bound: an adapter whose track stays open lives as
// long as its worker. A host with no tracks to close bounds it with
// keepAdapters.
let adapterCache = new Map<string, CachedAdapter>()
let requests = 0
let builds = 0

function identify(
  pluginManager: PluginManager,
  adapterConfig: ConfigSnap,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  if (!adapterConfig?.type) {
    throw new Error(
      `could not determine adapter type from adapter config snapshot ${JSON.stringify(
        adapterConfig,
      )}`,
    )
  }
  const keyedSequence =
    sequenceAdapter && readsReference(pluginManager, adapterConfig)
      ? sequenceAdapter
      : undefined
  const adapterType: string = adapterConfig.type
  const config = adapterIdentity(adapterConfig)
  const sequence = keyedSequence ? adapterIdentity(keyedSequence) : undefined
  return sequence
    ? {
        adapterType,
        key: `${config.key}|${sequence.key}`,
        credentials: `${config.credentials}|${sequence.credentials}`,
        keyedSequence,
      }
    : { ...config, adapterType, keyedSequence }
}

type Identity = ReturnType<typeof identify>

async function buildAdapter(
  pluginManager: PluginManager,
  adapterType: string,
  adapterConfigSnapshot: ConfigSnap,
  keyedSequence: Record<string, unknown> | undefined,
  owner: Owner,
) {
  const dataAdapterType = pluginManager.getAdapterType(adapterType)
  const adapterConfig = dataAdapterType.configSchema.create(
    adapterConfigSnapshot,
    { pluginManager },
  )
  // a sub-adapter reads the reference its parent was built with
  const getSubAdapter: getSubAdapterType = async conf =>
    owner.evicted
      ? {
          dataAdapter: await unclaimedAdapter(
            pluginManager,
            conf,
            keyedSequence,
          ),
          sessionIds: new Set<string>(),
        }
      : getAdapter(pluginManager, owner.claim, conf, keyedSequence)
  const CLASS = await dataAdapterType.getAdapterClass()
  return new CLASS(adapterConfig, getSubAdapter, pluginManager, keyedSequence)
}

function createEntry(
  pluginManager: PluginManager,
  adapterConfig: ConfigSnap,
  { adapterType, keyedSequence, credentials }: Identity,
  sessionIds: Set<string>,
): CachedAdapter {
  const owner = { claim: `sub:${++builds}`, evicted: false }
  return {
    adapter: buildAdapter(
      pluginManager,
      adapterType,
      adapterConfig,
      keyedSequence,
      owner,
    ),
    credentials,
    sessionIds,
    lastRequest: 0,
    owner,
  }
}

/**
 * The adapter an evicted parent asks for: the cached one if it is current,
 * else one built outside the cache, so a request finishing after its track
 * closed leaves nothing cached behind it.
 */
async function unclaimedAdapter(
  pluginManager: PluginManager,
  adapterConfig: ConfigSnap,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  const { adapterType, key, credentials, keyedSequence } = identify(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  const cached = adapterCache.get(key)
  return cached?.credentials === credentials
    ? cached.adapter
    : buildAdapter(pluginManager, adapterType, adapterConfig, keyedSequence, {
        claim: '',
        evicted: true,
      })
}

/**
 * The entry for a config, created if absent. One entry per identity: a request
 * carrying renewed credentials replaces the instance built with the old ones,
 * which a worker cannot renew, and inherits its claims.
 */
function entryFor(
  pluginManager: PluginManager,
  adapterConfig: ConfigSnap,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  const identity = identify(pluginManager, adapterConfig, sequenceAdapter)
  const cached = adapterCache.get(identity.key)
  return cached?.credentials === identity.credentials
    ? cached
    : storeEntry(pluginManager, adapterConfig, identity, cached)
}

function storeEntry(
  pluginManager: PluginManager,
  adapterConfig: ConfigSnap,
  identity: Identity,
  superseded: CachedAdapter | undefined,
) {
  const { key } = identity
  const entry = createEntry(
    pluginManager,
    adapterConfig,
    identity,
    superseded ? superseded.sessionIds : new Set(),
  )
  if (superseded) {
    void evict(key, superseded)
  }
  adapterCache.set(key, entry)
  void entry.adapter.catch(() => evict(key, entry))
  return entry
}

/**
 * instantiate a data adapter, or return a cached one with the same config.
 * `sequenceAdapter` is the reference of the genome the request names; a
 * {@link READS_REFERENCE} type is keyed on it and built with it, any other
 * type ignores it. The caller's claim is recorded before the adapter is
 * built, so a free racing the build cannot drop an adapter it holds.
 */
export async function getAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: ConfigSnap,
  sequenceAdapter: Record<string, unknown> | undefined,
) {
  const entry = entryFor(pluginManager, adapterConfigSnapshot, sequenceAdapter)
  entry.sessionIds.add(sessionId)
  entry.lastRequest = ++requests
  return { dataAdapter: await entry.adapter, sessionIds: entry.sessionIds }
}

/**
 * this is a callback that is passed to adapters that allows them to get any
 * sub-adapters that they need internally
 */
export type getSubAdapterType = (
  adapterConfigSnap: ConfigSnap,
) => ReturnType<typeof getAdapter>

async function evict(cacheKey: string, entry: CachedAdapter): Promise<void> {
  if (adapterCache.get(cacheKey) === entry) {
    adapterCache.delete(cacheKey)
  }
  if (!entry.owner.evicted) {
    entry.owner.evicted = true
    await Promise.all([
      entry.adapter.then(
        dataAdapter => {
          dataAdapter.freeResources()
        },
        () => {},
      ),
      releaseClaim(entry.owner.claim),
    ])
  }
}

async function releaseClaim(claim: string) {
  const evictions: Promise<void>[] = []
  for (const [cacheKey, entry] of [...adapterCache]) {
    if (entry.sessionIds.delete(claim) && entry.sessionIds.size === 0) {
      evictions.push(evict(cacheKey, entry))
    }
  }
  await Promise.all(evictions)
}

/**
 * Drop this session's claim on every cached adapter, and evict the ones no
 * other session still claims, along with the sub-adapters only they claimed.
 * Reached from the CoreFreeResources RPC when the last track using an adapter
 * config closes.
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
 */
export async function freeAdapterResources(args: { sessionId?: string }) {
  const { sessionId } = args
  if (sessionId) {
    await releaseClaim(sessionId)
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
  const cached = [...adapterCache].sort(
    ([, a], [, b]) => b.lastRequest - a.lastRequest,
  )
  const settled = await Promise.all(
    cached.map(([, entry]) => entry.adapter.catch(() => undefined)),
  )
  const evictions: Promise<void>[] = []
  cached.forEach(([cacheKey, entry], i) => {
    const dataAdapter = settled[i]
    if (
      dataAdapter &&
      !entry.owner.evicted &&
      !keep(dataAdapter, entry.lastRequest)
    ) {
      evictions.push(evict(cacheKey, entry))
    }
  })
  await Promise.all(evictions)
}

/** How many adapters the cache holds, failed and pending ones included. */
export function cachedAdapterCount() {
  return adapterCache.size
}

export function clearAdapterCache() {
  adapterCache = new Map()
}
