import React from 'react'
import { renderToString } from 'react-dom/server'
import { toArray } from 'rxjs/operators'
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

export async function renderRegion(
  pluginManager,
  { region, trackId, adapterType, adapterConfig, rendererType, renderProps },
) {
  // TODO: cache the adapter object
  const dataAdapterType = pluginManager.getAdapterType(adapterType)
  if (!dataAdapterType)
    throw new Error(`unknown data adapter type ${adapterType}`)
  const dataAdapter = new dataAdapterType.AdapterClass(adapterConfig)

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

  return { features, html, ...renderResult }
}
