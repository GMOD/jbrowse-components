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

function adapterConfigCacheKey(adapterType, adapterConfig, rootConfig) {
  return (
    `${adapterType}|` +
    `${jsonStableStringify(removeConfigIds(adapterConfig))}|` +
    `${jsonStableStringify(removeConfigIds(rootConfig))}`
  )
}

const adapterCache = {}

/**
 * instantiate a data adapter, or return an already-instantiated one if we have one with the same
 * configuration
 *
 * @param {PluginManager} pluginManager
 * @param {string} sessionId session ID of the associated worker session. used for reference counting
 * @param {string} adapterType type name of the adapter to instantiate
 * @param {object} adapterConfig plain-JS configuration snapshot for the adapter
 * @param {object}rootrConfig plain-JS root configuration snapshot
 */
export async function getAdapter(
  pluginManager,
  sessionId,
  adapterType,
  adapterConfig,
  rootConfig,
) {
  // cache the adapter object
  const cacheKey = adapterConfigCacheKey(adapterType, adapterConfig, rootConfig)
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType)
      throw new Error(`unknown data adapter type ${adapterType}`)
    // console.log('new adapter', cacheKey)
    const dataAdapter = new dataAdapterType.AdapterClass(adapterConfig)
    let assemblyAliases = []
    const seqNameMap = new Map()

    let { assemblyName } = adapterConfig
    if (assemblyName) {
      const assemblies = rootConfig.assemblies || {}
      let seqNameAliases = {}
      if (assemblies[assemblyName]) {
        assemblyAliases = assemblies[assemblyName].aliases || []
        ;({ seqNameAliases = {} } = assemblies[assemblyName])
      } else
        Object.keys(assemblies).forEach(assembly => {
          if ((assemblies[assembly].aliases || []).includes(assemblyName)) {
            assemblyName = assembly
            assemblyAliases = assemblies[assembly].aliases || []
            ;({ seqNameAliases = {} } = assemblies[assembly])
          }
        })

      const refSeqs = await dataAdapter.loadData()
      refSeqs.forEach(seqName => {
        seqNameMap.set(seqName, seqName)
        if (seqNameAliases[seqName])
          seqNameAliases[seqName].forEach(seqNameAlias => {
            seqNameMap.set(seqNameAlias, seqName)
          })
        else
          Object.keys(seqNameAliases).forEach(configSeqName => {
            if (seqNameAliases[configSeqName].includes(seqName)) {
              seqNameMap.set(configSeqName, seqName)
              seqNameAliases[configSeqName].forEach(seqNameAlias => {
                seqNameMap.set(seqNameAlias, seqName)
              })
            }
          })
      })
    }

    adapterCache[cacheKey] = {
      dataAdapter,
      sessionIds: new Set([sessionId]),
      assemblyAliases,
      seqNameMap,
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
  }
  // otherwise call freeResources on all the cached data adapters
  else {
    Object.values(adapterCache).forEach(cacheEntry => {
      cacheEntry.adapter.freeResources(specification)
    })
  }

  return deleteCount
}
