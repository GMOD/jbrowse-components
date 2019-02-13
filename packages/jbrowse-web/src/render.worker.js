import './workerPolyfill'

import { useStaticRendering } from 'mobx-react'

import RpcServer from '@librpc/web'

import JBrowse from './JBrowse'
import { freeAdapterResources, getAdapter } from './util/workerDataAdapterCache'

// prevent mobx-react from doing funny things when we render in the worker
useStaticRendering(true)

let jbrowse

async function setup() {
  if (!jbrowse) jbrowse = await new JBrowse().configure()
}

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
  await setup()

  const { dataAdapter, assemblyAliases, seqNameMap } = await getAdapter(
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

  // Regularize assembly
  const { assemblyName } = adapterConfig
  if (
    assemblyName &&
    region.assemblyName &&
    assemblyName !== region.assemblyName
  )
    if (assemblyAliases.includes(region.assemblyName))
      region.assemblyName = assemblyName
  // Regularize reference name
  region.refName = seqNameMap.get(region.refName) || region.refName

  return RendererType.renderInWorker({
    ...renderProps,
    sessionId,
    dataAdapter,
    region,
  })
}

function wrapForRpc(func) {
  return async args => {
    // console.log(`${func.name} args`, args)
    await setup()
    let result
    try {
      result = func(jbrowse.pluginManager, args)
    } catch (error) {
      console.error(error)
      throw error
    }
    // uncomment the below to log the data that the worker is
    // returning to the main thread
    // console.log(`${func.name} returned`, await result)
    return result
  }
}

// eslint-disable-next-line no-restricted-globals
self.rpcServer = new RpcServer.Server({
  renderRegion: wrapForRpc(renderRegion),
  freeResources: wrapForRpc(freeResources),
})
