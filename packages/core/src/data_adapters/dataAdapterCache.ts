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

let adapterCache: Record<string, Promise<AdapterCacheEntry>> = {}

/** stores a promise in the cache and auto-evicts if it rejects */
function storeWithEvict(key: string, p: Promise<AdapterCacheEntry>) {
  p.catch(() => {
    delete adapterCache[key]
  })
  adapterCache[key] = p
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
  if (!dataAdapterType) {
    throw new Error(`unknown data adapter type ${adapterType}`)
  }

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

/** instantiate a data adapter, or return a cached one with the same config */
export async function getAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
): Promise<AdapterCacheEntry> {
  const cacheKey = adapterConfigCacheKey(adapterConfigSnapshot)
  if (!adapterCache[cacheKey]) {
    storeWithEvict(cacheKey, getAdapterPre(pluginManager, sessionId, adapterConfigSnapshot))
  }
  const ret = await adapterCache[cacheKey]!
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
      console.error(`dataAdapterCache: evicting failed adapter "${cacheKey}"`, e)
      delete adapterCache[cacheKey]
    }
  }
}

export function clearAdapterCache() {
  adapterCache = {}
}
