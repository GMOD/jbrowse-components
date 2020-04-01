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
 * @param {object} adapterConfig plain-JS configuration snapshot for the adapter
 */
export function getAdapter(
  pluginManager,
  sessionId,
  adapterType,
  adapterConfig,
  sequenceAdapterType,
  sequenceAdapterConfig,
) {
  // cache the adapter object
  const cacheKey =
    adapterConfigCacheKey(adapterType, adapterConfig) +
    adapterConfigCacheKey(sequenceAdapterType, sequenceAdapterConfig)
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType) {
      throw new Error(`unknown data adapter type ${adapterType}`)
    }

    // Some adapters use the special sequence store
    // specifically CRAM
    if (
      dataAdapterType.requiresSequenceAdapter &&
      sequenceAdapterType &&
      sequenceAdapterConfig
    ) {
      adapterConfig.sequenceAdapter = getAdapter(
        pluginManager,
        sessionId,
        sequenceAdapterType,
        sequenceAdapterConfig,
      ).dataAdapter
    }

    // Some adapters initialize a subadapter
    if (adapterConfig.subadapter) {
      adapterConfig.subadapter = getAdapter(
        pluginManager,
        sessionId,
        adapterConfig.subadapter.type,
        adapterConfig.subadapter,
        sequenceAdapterType,
        sequenceAdapterConfig,
      ).dataAdapter
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
      if (!cacheEntry.dataAdapter.freeResources) {
        console.warn(cacheEntry.dataAdapter, 'does not implement freeResources')
      } else {
        cacheEntry.dataAdapter.freeResources(specification)
      }
    })
  }

  return deleteCount
}
