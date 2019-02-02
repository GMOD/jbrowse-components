import './workerPolyfill'

import { useStaticRendering } from 'mobx-react'

import RpcServer from '@librpc/web'

import JBrowse from './JBrowse'
import { freeAdapterResources, getAdapter } from './util/workerDataAdapterCache'

// prevent mobx-react from doing funny things when we render in the worker
useStaticRendering(true)

const jbrowse = new JBrowse().configure()

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export function freeResources(pluginManager, specification) {
  let deleteCount = 0

  deleteCount += freeAdapterResources(specification)

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
  {
    region,
    sessionId,
    adapterType,
    adapterConfig,
    rootConfig,
    rendererType,
    renderProps,
  },
) {
  if (!sessionId) throw new Error('must pass a unique session id')

  const dataAdapter = getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
    rootConfig,
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
    // console.log(args)
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
