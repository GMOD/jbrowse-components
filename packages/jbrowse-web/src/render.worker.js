import './workerPolyfill'

import jsonStableStringify from 'json-stable-stringify'

import { useStaticRendering } from 'mobx-react'

import RpcServer from '@librpc/web'

import JBrowse from './JBrowse'

useStaticRendering(true)

const jbrowse = new JBrowse().configure()

const adapterCache = {}
function getAdapter(pluginManager, sessionId, adapterType, adapterConfig) {
  // cache the adapter object
  const cacheKey = `${adapterType}|${jsonStableStringify(adapterConfig)}`
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType)
      throw new Error(`unknown data adapter type ${adapterType}`)
    adapterCache[cacheKey] = {
      adapter: new dataAdapterType.AdapterClass(adapterConfig),
      sessionIds: new Set([sessionId]),
    }
  }
  const cacheEntry = adapterCache[cacheKey]
  cacheEntry.sessionIds.add(sessionId)

  return cacheEntry.adapter
}

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export function freeResources(pluginManager, specification) {
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

  // pass the freeResources hint along to all the renderers as well
  pluginManager.getElementTypesInGroup('renderer').forEach(renderer => {
    const count = renderer.freeResources(specification)
    if (count) deleteCount += count
  })

  return deleteCount
}

/**
 * render a single region
 * @param {*} pluginManager
 * @param {object} args
 * @param {*} args.region
 * @param {*} args.sessionId
 * @param {*} args.adapterType
 * @param {*} args.adapterConfig
 * @param {*} args.rendererType
 * @param {*} args.renderProps
 */
export async function renderRegion(
  pluginManager,
  { region, sessionId, adapterType, adapterConfig, rendererType, renderProps },
) {
  if (!sessionId) throw new Error('must pass a unique session id')

  const dataAdapter = getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )

  const RendererType = pluginManager.getRendererType(rendererType)
  if (!RendererType) throw new Error(`renderer "${rendererType}" not found`)
  if (!RendererType.ReactComponent)
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )

  return RendererType.renderInWorker({
    ...renderProps,
    sessionId,
    dataAdapter,
    region,
  })
}

function wrapForRpc(func) {
  return args => {
    const result = func(jbrowse.pluginManager, args).catch(e => {
      console.error(e)
      throw e
    })
    // result.then(r => console.log(r))
    return result
  }
}

// eslint-disable-next-line no-restricted-globals
self.rpcServer = new RpcServer.Server({
  renderRegion: wrapForRpc(renderRegion),
  freeResources: wrapForRpc(freeResources),
})
