/**
 *
 */

import jsonStableStringify from 'json-stable-stringify'

function adapterConfigCacheKey(adapterType, adapterConfig) {
  return `${adapterType}|${jsonStableStringify(adapterConfig)}`
}

const adapterCache = {}

/**
 * instantiate a data adapter, or return an already-instantiated one if we have one with the same
 * configuration
 *
 * @param {PluginManager} pluginManager
 * @param {string} sessionId session ID of the associated worker session.
 *   used for reference counting
 * @param {string} adapterType type name of the adapter to instantiate
 * @param {object} adapterConfigSnapshot plain-JS configuration snapshot for the adapter
 */
export function getAdapter(
  pluginManager,
  sessionId,
  adapterType,
  adapterConfigSnapshot,
) {
  // cache the adapter object
  const cacheKey = adapterConfigCacheKey(adapterType, adapterConfigSnapshot)
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType) {
      throw new Error(`unknown data adapter type ${adapterType}`)
    }

    // instantiate the data adapter's config schema so it gets its defaults,
    // callbacks, etc
    const adapterConfig = dataAdapterType.configSchema.create(
      adapterConfigSnapshot,
    )

    // instantiate the adapter itself with its config schema, and a bound
    // func that it can use to get any inner adapters
    // (such as sequence adapters or wrapped subadapters) that it needs
    const dataAdapter = new dataAdapterType.AdapterClass(
      adapterConfig,
      getAdapter.bind(this, pluginManager, sessionId),
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

export function freeAdapterResources(specification) {
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
        cacheEntry.dataAdapter.freeResources(specification)
      }
    })
  }

  return deleteCount
}
