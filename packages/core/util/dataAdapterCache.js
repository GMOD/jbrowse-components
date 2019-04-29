/**
 *
 */

import jsonStableStringify from 'json-stable-stringify'

function removeConfigIds(thing) {
  if (typeof thing === 'object') {
    const filtered = { ...thing }
    delete filtered.configId
    Object.entries(filtered).forEach(([k, v]) => {
      filtered[k] = removeConfigIds(v)
    })
    return filtered
  }
  return thing
}

function adapterConfigCacheKey(adapterType, adapterConfig) {
  return `${adapterType}|${jsonStableStringify(removeConfigIds(adapterConfig))}`
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
 * @param {object} adapterConfig plain-JS configuration snapshot for the adapter
 */
export function getAdapter(
  pluginManager,
  sessionId,
  adapterType,
  adapterConfig,
) {
  // cache the adapter object
  const cacheKey = adapterConfigCacheKey(adapterType, adapterConfig)
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType) {
      throw new Error(`unknown data adapter type ${adapterType}`)
    }
    // console.log('new adapter', cacheKey)
    const dataAdapter = new dataAdapterType.AdapterClass(adapterConfig)

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
      cacheEntry.adapter.freeResources(specification)
    })
  }

  return deleteCount
}
