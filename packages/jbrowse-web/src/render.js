import Rpc from '@librpc/web'

import { objectFromEntries } from './util'

const getClient = app =>
  new Rpc.Client({
    workers: app.workerManager.getWorkerGroup('render'),
  })

function isClonable(thing) {
  if (typeof thing === 'function') return false
  if (thing instanceof Error) return false
  return true
}

// filter the given object and just remove any non-clonable things from it
function removeNonClonable(thing) {
  if (Array.isArray(thing)) {
    return thing.filter(isClonable).map(removeNonClonable)
  }
  if (typeof thing === 'object') {
    const newobj = objectFromEntries(
      Object.entries(thing)
        .filter(e => isClonable(e[1]))
        .map(([k, v]) => [k, removeNonClonable(v)]),
    )
    return newobj
  }
  return thing
}

/**
 * render a region in a web worker
 *
 * @param {object} app the enclosing application
 * @param {object} args the render arguments
 * @returns {Promise[object]} object containing the rendering results
 * (e.g. html, features, a computed layout for the features)
 */
export async function renderRegionWithWorker(app, args) {
  const filteredArgs = removeNonClonable(args)
  const result = await getClient(app).call('renderRegion', filteredArgs, {
    timeout: args.timeout,
  })

  return result
}

export async function freeSessionResourcesInWorker(pluginManager, sessionId) {
  return getClient(pluginManager).call('freeSessionResources', sessionId)
}
