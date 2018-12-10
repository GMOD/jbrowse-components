import Rpc from '@librpc/web'

const getClient = app =>
  new Rpc.Client({
    workers: app.getWorkerGroup('render'),
  })

export async function renderRegionWithWorker(app, args) {
  const result = await getClient(app).call('renderRegion', args, {
    timeout: args.timeout,
  })

  return result
}

export async function freeSessionResourcesInWorker(pluginManager, sessionId) {
  return getClient(pluginManager).call('freeSessionResources', sessionId)
}
