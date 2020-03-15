import { checkAbortSignal } from '@gmod/jbrowse-core/util'
import {
  freeAdapterResources,
  getAdapter,
} from '@gmod/jbrowse-core/util/dataAdapterCache'
import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
} from '@gmod/jbrowse-core/rpc/remoteAbortSignals'

export async function getGlobalStats(
  pluginManager,
  { adapterType, adapterConfig, signal, sessionId },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getGlobalStats({ signal })
}

export async function getRegionStats(
  pluginManager,
  { region, adapterType, adapterConfig, signal, bpPerPx, sessionId },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getRegionStats(region, { signal, bpPerPx })
}

export async function getMultiRegionStats(
  pluginManager,
  { regions, adapterType, adapterConfig, signal, bpPerPx, sessionId },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getMultiRegionStats(regions, { signal, bpPerPx })
}

export async function getRegions(
  pluginManager,
  { sessionId, adapterType, signal, adapterConfig },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getRegions({ signal })
}

export async function getRefNames(
  pluginManager,
  {
    sessionId,
    signal,
    adapterType,
    adapterConfig,
    sequenceAdapterType,
    sequenceAdapterConfig,
  },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
    sequenceAdapterType,
    sequenceAdapterConfig,
  )
  return dataAdapter.getRefNames({ signal })
}

export async function getRefNameAliases(
  pluginManager,
  { sessionId, adapterType, signal, adapterConfig },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterType,
    adapterConfig,
  )
  return dataAdapter.getRefNameAliases({ signal })
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
    const count = renderer.freeResourcesInWorker(specification)
    if (count) deleteCount += count
  })

  return deleteCount
}

/**
 * call a renderer with the given args
 * s
 * @param {PluginManager} pluginManager
 * @param {object} args
 * @param {object} args.regions - array of regions to render. some renderers (such as circular chord tracks) accept multiple at a time
 * @param {string} args.sessionId
 * @param {string} args.adapterType
 * @param {object} args.adapterConfig
 * @param {string} args.rendererType
 * @param {object} args.renderProps
 * @param {AbortSignal} [args.signal]
 */
export async function render(
  pluginManager,
  {
    regions,
    region,
    originalRegion,
    originalRegions,
    sessionId,
    adapterType,
    adapterConfig,
    sequenceAdapterType,
    sequenceAdapterConfig,
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
    sequenceAdapterType,
    sequenceAdapterConfig,
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
    regions,
    region,
    originalRegions,
    originalRegion,
    signal,
  })
  checkAbortSignal(signal)
  return result
}

/**
 * call a synteny renderer with the given args
 * param views: a set of views that each contain a set of regions
 * used instead of passing regions directly as in render()
 */
export async function comparativeRender(
  pluginManager,
  {
    views,
    sessionId,
    adapterType,
    adapterConfig,
    sequenceAdapterType,
    sequenceAdapterConfig,
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
    sequenceAdapterType,
    sequenceAdapterConfig,
  )

  const RendererType = pluginManager.getRendererType(rendererType)
  if (!RendererType) throw new Error(`renderer "${rendererType}" not found`)
  if (!RendererType.ReactComponent)
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )

  const result = await RendererType.renderInWorker({
    ...renderProps,
    pluginManager,
    sessionId,
    dataAdapter,
    views,
    signal,
  })
  checkAbortSignal(signal)
  return result
}
