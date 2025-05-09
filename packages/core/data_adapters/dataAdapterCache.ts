import { adapterConfigCacheKey } from './util'

import type PluginManager from '../PluginManager'
import type { AnyConfigurationSchemaType } from '../configuration'
import type { AnyDataAdapter } from './BaseAdapter'
import type { SnapshotIn } from 'mobx-state-tree'

type ConfigSnap = SnapshotIn<AnyConfigurationSchemaType>

interface AdapterCacheEntry {
  dataAdapter: AnyDataAdapter
  sessionIds: Set<string>
}

let adapterCache: Record<string, AdapterCacheEntry> = {}

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
  // cache the adapter object
  const cacheKey = adapterConfigCacheKey(adapterConfigSnapshot)
  if (!adapterCache[cacheKey]) {
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

    // store it in our cache
    adapterCache[cacheKey] = {
      dataAdapter,
      sessionIds: new Set([sessionId]),
    }
  }

  const cacheEntry = adapterCache[cacheKey]
  cacheEntry.sessionIds.add(sessionId)

  return cacheEntry
}

/**
 * this is a callback that is passed to adapters that allows them to get any
 * sub-adapters that they need internally, staying with the same worker session
 * ID
 */
export type getSubAdapterType = (
  adapterConfigSnap: ConfigSnap,
) => ReturnType<typeof getAdapter>

export function freeAdapterResources(args: Record<string, any>) {
  const specKeys = Object.keys(args)

  // TODO: little hacky...should make it an explicit command but:
  // if we don't specify a range, delete any adapters that are only associated
  // with that session
  if (specKeys.length === 1 && specKeys[0] === 'sessionId') {
    const { sessionId } = args
    for (const [cacheKey, cacheEntry] of Object.entries(adapterCache)) {
      cacheEntry.sessionIds.delete(sessionId)
      if (cacheEntry.sessionIds.size === 0) {
        delete adapterCache[cacheKey]
      }
    }
  } else {
    // otherwise call freeResources on all the cached data adapters
    for (const cacheEntry of Object.values(adapterCache)) {
      const regions = args.regions || (args.region ? [args.region] : [])
      for (const region of regions) {
        if (region.refName !== undefined) {
          cacheEntry.dataAdapter.freeResources(region)
        }
      }
    }
  }
}

export function clearAdapterCache() {
  adapterCache = {}
}
