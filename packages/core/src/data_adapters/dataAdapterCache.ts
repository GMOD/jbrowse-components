export { adapterConfigCacheKey } from './util.ts'
import { adapterConfigCacheKey } from './util.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationSchemaType } from '../configuration/index.ts'
import type { AnyDataAdapter } from './BaseAdapter/index.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

type ConfigSnap = SnapshotIn<AnyConfigurationSchemaType>

interface AdapterCacheEntry {
  dataAdapter: AnyDataAdapter
  sessionIds: Set<string>
}

let adapterCache: Record<string, Promise<AdapterCacheEntry>> = {}

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

  const getSubAdapter = getAdapter.bind(null, pluginManager, sessionId)
  const CLASS = await dataAdapterType.getAdapterClass()
  const dataAdapter = new CLASS(adapterConfig, getSubAdapter, pluginManager)

  return {
    dataAdapter,
    sessionIds: new Set([sessionId]),
  }
}

/**
 * instantiate a data adapter, or return an already-instantiated one if we have
 * one with the same configuration
 *
 * @param pluginManager
 *
 * @param sessionId - session ID of the associated worker session. used for
 * reference counting
 *
 * @param adapterConfigSnapshot - plain-JS configuration snapshot for the
 * adapter
 */
export async function getAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
): Promise<AdapterCacheEntry> {
  const cacheKey = adapterConfigCacheKey(adapterConfigSnapshot)
  adapterCache[cacheKey] ??= getAdapterPre(
    pluginManager,
    sessionId,
    adapterConfigSnapshot,
  )
  const ret = await adapterCache[cacheKey]
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
  // drop any adapters that were only associated with this session. (the
  // previous per-region branch is gone — no in-tree adapter overrode
  // freeResources to do anything per-region.)
  const { sessionId } = args
  if (!sessionId) {
    return
  }
  for (const [cacheKey, cacheEntryP] of Object.entries(adapterCache)) {
    const cacheEntry = await cacheEntryP
    cacheEntry.sessionIds.delete(sessionId)
    if (cacheEntry.sessionIds.size === 0) {
      delete adapterCache[cacheKey]
    }
  }
}

export function clearAdapterCache() {
  adapterCache = {}
}
