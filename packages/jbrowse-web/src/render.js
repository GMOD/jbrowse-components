import React from 'react'
import { renderToString } from 'react-dom/server'
import { toArray } from 'rxjs/operators'

import jsonStableStringify from 'json-stable-stringify'

import Rpc from '@librpc/web'

import SimpleFeature from './util/feature'

// import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'

export function fog() {}

// // given an object of things that might be MST models, snapshots any of them
// // that are not already snapshots
// function ensureSnapshots(things) {
//   const data = {}
//   Object.entries(things).forEach(([key, value]) => {
//     if (isStateTreeNode(value)) {
//       data[key] = getSnapshot(value)
//     } else {
//       data[key] = value
//     }
//   })
//   return data
// }

export async function renderRegionWithWorker(pluginManager, args) {
  const rpcClient = new Rpc.Client({
    workers: pluginManager.getWorkerGroup('render'),
  })
  const result = await rpcClient.call('renderRegion', args, {
    timeout: 999999999,
  })

  // convert the feature JSON to SimpleFeature objects
  result.features = result.featureJSON.map(j => SimpleFeature.fromJSON(j))
  return result
}

const adapterCache = {}
function getAdapter(pluginManager, adapterType, adapterConfig) {
  // cache the adapter object
  const cacheKey = `${adapterType}|${jsonStableStringify(adapterConfig)}`
  if (!adapterCache[cacheKey]) {
    const dataAdapterType = pluginManager.getAdapterType(adapterType)
    if (!dataAdapterType)
      throw new Error(`unknown data adapter type ${adapterType}`)
    adapterCache[cacheKey] = new dataAdapterType.AdapterClass(adapterConfig)
  }
  return adapterCache[cacheKey]
}

export async function renderRegion(
  pluginManager,
  { region, trackId, adapterType, adapterConfig, rendererType, renderProps },
) {
  const dataAdapter = getAdapter(pluginManager, adapterType, adapterConfig)
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
    trackId,
    ...renderProps,
  })
  const html = renderToString(element)

  return { featureJSON: features.map(f => f.toJSON()), html, ...renderResult }
}
