import jsonStableStringify from 'json-stable-stringify'
import { SnapshotIn } from 'mobx-state-tree'
import PluginManager from '../PluginManager'
import { AnyConfigurationSchemaType } from '../configuration/configurationSchema'
import { AnyDataAdapter } from './BaseAdapter'
import { Region } from '../util/types'

function adapterConfigCacheKey(
  adapterConfig: SnapshotIn<AnyConfigurationSchemaType>,
) {
  return `${jsonStableStringify(adapterConfig)}`
}

interface AdapterCacheEntry {
  dataAdapter: AnyDataAdapter
  sessionIds: Set<string>
}

let adapterCache: Record<string, AdapterCacheEntry> = {}

/**
 * instantiate a data adapter, or return an already-instantiated one if we have one with the same
 * configuration
 *
 * @param pluginManager -
 * @param sessionId - session ID of the associated worker session.
 *   used for reference counting
 * @param adapterConfigSnapshot - plain-JS configuration snapshot for the adapter
 */
export function getAdapter(
  pluginManager: PluginManager,
  sessionId: string,
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
) {
  // cache the adapter object
  const cacheKey = adapterConfigCacheKey(adapterConfigSnapshot)
  if (!adapterCache[cacheKey]) {
    const adapterType = (adapterConfigSnapshot || {}).type
    if (!adapterType)
      throw new Error(
        'could not determine adapter type from adapter config snapshot',
      )
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType) {
      throw new Error(`unknown data adapter type ${adapterType}`)
    }

    // instantiate the data adapter's config schema so it gets its defaults,
    // callbacks, etc
    const adapterConfig = dataAdapterType.configSchema.create(
      adapterConfigSnapshot,
    )

    const getSubAdapter: getSubAdapterType = getAdapter.bind(
      null,
      pluginManager,
      sessionId,
    )
    // instantiate the adapter itself with its config schema, and a bound
    // func that it can use to get any inner adapters
    // (such as sequence adapters or wrapped subadapters) that it needs
    const dataAdapter = new dataAdapterType.AdapterClass(
      adapterConfig,
      getSubAdapter,
    )

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
 * this is a callback that is passed to adapters that
 * allows them to get any sub-adapters that they need
 * internally, staying with the same worker session ID
 */
export type getSubAdapterType = (
  adapterConfigSnapshot: SnapshotIn<AnyConfigurationSchemaType>,
) => ReturnType<typeof getAdapter>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function freeAdapterResources(specification: Record<string, any>) {
  let deleteCount = 0

  const specKeys = Object.keys(specification)

  // if we don't specify a range, delete any adapters that are
  // only associated with that session
  if (specKeys.length === 1 && specKeys[0] === 'sessionId') {
    const { sessionId } = specification
    Object.entries(adapterCache).forEach(([cacheKey, cacheEntry]) => {
      cacheEntry.sessionIds.delete(sessionId)
      if (cacheEntry.sessionIds.size === 0) {
        deleteCount += 1
        delete adapterCache[cacheKey]
      }
    })
  } else {
    // otherwise call freeResources on all the cached data adapters
    Object.values(adapterCache).forEach(cacheEntry => {
      if (!cacheEntry.dataAdapter.freeResources) {
        console.warn(cacheEntry.dataAdapter, 'does not implement freeResources')
      } else {
        const regions =
          specification.regions ||
          (specification.region ? [specification.region] : [])
        regions.forEach((region: Region) => {
          if (region.refName !== undefined)
            cacheEntry.dataAdapter.freeResources(region)
        })
      }
    })
  }

  return deleteCount
}

export function clearAdapterCache() {
  adapterCache = {}
}
