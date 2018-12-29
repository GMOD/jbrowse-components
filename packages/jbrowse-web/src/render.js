import Rpc from '@librpc/web'

import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'
import { objectFromEntries } from './util'

const getClient = app =>
  new Rpc.Client({
    workers: app.getWorkerGroup('render'),
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
