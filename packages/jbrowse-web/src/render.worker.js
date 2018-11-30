import './workerPolyfill'

import { renderToString } from 'react-dom/server'
import { toArray } from 'rxjs/operators'

import jsonStableStringify from 'json-stable-stringify'

import RpcServer from '@librpc/web'

import JBrowse from './JBrowse'

const jbrowse = new JBrowse().configure()

const adapterCache = {}
function getAdapter(pluginManager, trackId, adapterType, adapterConfig) {
  // cache the adapter object
  const cacheKey = `${adapterType}|${jsonStableStringify(adapterConfig)}`
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType)
      throw new Error(`unknown data adapter type ${adapterType}`)
    adapterCache[cacheKey] = {
      adapter: new dataAdapterType.AdapterClass(adapterConfig),
      trackIds: new Set([trackId]),
    }
  }
  const cacheEntry = adapterCache[cacheKey]
  cacheEntry.trackIds.add(trackId)

  return cacheEntry.adapter
}

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export function freeSessionResources(trackId) {
  let deleteCount = 0
  Object.entries(adapterCache).forEach(([cacheKey, cacheEntry]) => {
    cacheEntry.trackIds.delete(trackId)
    if (cacheEntry.trackIds.size === 0) {
      deleteCount += 1
      delete adapterCache[cacheKey]
    }
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
  const features = await dataAdapter
    .getFeaturesInRegion(region)
    .pipe(toArray())
    .toPromise()

  const RendererType = pluginManager.getRendererType(rendererType)
  if (!RendererType) throw new Error(`renderer "${rendererType} not found`)
  if (!RendererType.ReactComponent)
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  const { element, ...renderResult } = RendererType.render({
    region,
    dataAdapter,
    data: features,
    sessionId,
    ...renderProps,
  })
  const html = renderToString(element)

  return { featureJSON: features.map(f => f.toJSON()), html, ...renderResult }
}

// eslint-disable-next-line no-restricted-globals
self.rpcServer = new RpcServer.Server({
  renderRegion: args =>
    renderRegion(jbrowse.pluginManager, args).catch(e => {
      console.error(e)
      throw e
    }),
  freeSessionResources,
})
