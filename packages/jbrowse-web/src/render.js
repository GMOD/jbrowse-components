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

const getClient = pluginManager =>
  new Rpc.Client({
    workers: pluginManager.getWorkerGroup('render'),
  })

export async function renderRegionWithWorker(pluginManager, args) {
  const result = await getClient(pluginManager).call('renderRegion', args, {
    timeout: args.timeout,
  })

  // convert the feature JSON to SimpleFeature objects
  result.features = result.featureJSON.map(j => SimpleFeature.fromJSON(j))
  return result
}

export async function freeSessionResourcesInWorker(pluginManager, sessionId) {
  return getClient(pluginManager).call('freeSessionResources', sessionId)
}
