import { freeAdapterResources, getAdapter } from '@gmod/jbrowse-core/util/dataAdapterCache'
import {
  isRemoteAbortSignal,
  deserializeAbortSignal,
} from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { checkAbortSignal } from '@gmod/jbrowse-core/util'

export async function getRegionStats(
  pluginManager,
  { region, adapterType, adapterConfig, signal, sessionId },
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getGlobalStats(region, signal)
}

export async function getMultiRegionStats(
  pluginManager,
  { regions, adapterType, adapterConfig, signal, sessionId },
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getMultiRegionStats(regions, signal)
}

export async function getRegions(
  pluginManager,
  { sessionId, adapterType, adapterConfig },
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getRegions()
}

export async function getRefNames(
  pluginManager,
  { sessionId, adapterType, adapterConfig },
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getRefNames()
}

export async function getRefNameAliases(
  pluginManager,
  { sessionId, adapterType, adapterConfig },
) {
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getRefNameAliases()
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
 * @param {PluginManager} pluginManager
 * @param {object} args
 * @param {object} args.region
 * @param {string} args.sessionId
 * @param {string} args.adapterType
 * @param {object} args.adapterConfig
 * @param {string} args.rendererType
 * @param {object} args.renderProps
 * @param {AbortSignal} [args.signal]
 */
export async function renderRegion(
  pluginManager,
  {
    region,
    sessionId,
    adapterType,
    adapterConfig,
    rendererType,
    renderProps,
    signal,
  },
) {
  if (!sessionId) throw new Error('must pass a unique session id')

  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }
  checkAbortSignal(signal)

  const { dataAdapter } = getAdapter(
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

  const result = await RendererType.renderInWorker({
    ...renderProps,
    sessionId,
    dataAdapter,
    region,
    signal,
  })
  checkAbortSignal(signal)
  return result
}
