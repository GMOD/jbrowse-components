import { freeAdapterResources, getAdapter } from './util/dataAdapterCache'

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
  { region, sessionId, adapterType, adapterConfig, rendererType, renderProps },
) {
  if (!sessionId) throw new Error('must pass a unique session id')

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

  return RendererType.renderInWorker({
    ...renderProps,
    sessionId,
    dataAdapter,
    region,
  })
}
