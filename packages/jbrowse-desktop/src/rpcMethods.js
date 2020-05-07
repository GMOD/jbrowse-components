import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  deserializeAbortSignal,
  isRemoteAbortSignal,
  remoteAbortRpcHandler,
} from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { checkAbortSignal, isAbortException } from '@gmod/jbrowse-core/util'
import {
  freeAdapterResources,
  getAdapter,
} from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { useStaticRendering } from 'mobx-react'
import corePlugins from './corePlugins'

window.rpcStuff = {
  useStaticRendering,
  PluginManager,
  remoteAbortRpcHandler,
  isAbortException,
  corePlugins,
}

const { electron, electronBetterIpc } = window

const { ipcRenderer } = electronBetterIpc

let mainWindow

// eslint-disable-next-line no-console
const originalConsoleLog = console.log.bind(console)
// eslint-disable-next-line no-console
console.log = async (...args) => {
  if (!mainWindow) {
    const mainWindowId = await ipcRenderer.invoke('getMainWindowId')
    mainWindow = electron.remote.BrowserWindow.fromId(mainWindowId)
  }
  ipcRenderer.sendTo(mainWindow.webContents.id, 'consoleLog', ...args)
  originalConsoleLog(...args)
}

const originalConsoleWarn = console.warn.bind(console)
console.warn = async (...args) => {
  if (!mainWindow) {
    const mainWindowId = await ipcRenderer.invoke('getMainWindowId')
    mainWindow = electron.remote.BrowserWindow.fromId(mainWindowId)
  }
  ipcRenderer.sendTo(mainWindow.webContents.id, 'consoleWarn', ...args)
  originalConsoleWarn(...args)
}

const originalConsoleError = console.error.bind(console)
console.error = async (...args) => {
  if (!mainWindow) {
    const mainWindowId = await ipcRenderer.invoke('getMainWindowId')
    mainWindow = electron.remote.BrowserWindow.fromId(mainWindowId)
  }
  ipcRenderer.sendTo(mainWindow.webContents.id, 'consoleError', ...args)
  originalConsoleError(...args)
}

async function getGlobalStats(
  pluginManager,
  { adapterConfig, signal, sessionId },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  return dataAdapter.getGlobalStats({ signal })
}

async function getRegionStats(
  pluginManager,
  { region, adapterConfig, signal, bpPerPx, sessionId },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  return dataAdapter.getRegionStats(region, { signal, bpPerPx })
}

async function getMultiRegionStats(
  pluginManager,
  { regions, adapterConfig, signal, bpPerPx, sessionId },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  return dataAdapter.getMultiRegionStats(regions, { signal, bpPerPx })
}

async function getRegions(pluginManager, { sessionId, signal, adapterConfig }) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  return dataAdapter.getRegions({ signal })
}

async function getRefNames(
  pluginManager,
  { sessionId, signal, adapterConfig },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )
  return dataAdapter.getRefNames({ signal })
}

async function getRefNameAliases(
  pluginManager,
  { sessionId, signal, adapterConfig },
) {
  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }
  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
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
function freeResources(pluginManager, specification) {
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
 * @param {object} args.adapterConfig
 * @param {string} args.rendererType
 * @param {object} args.renderProps
 * @param {AbortSignal} [args.signal]
 */
async function render(
  pluginManager,
  {
    regions,
    originalRegions,
    sessionId,
    adapterConfig,
    rendererType,
    renderProps,
    signal,
  },
) {
  if (!sessionId) {
    throw new Error('must pass a unique session id')
  }

  if (isRemoteAbortSignal(signal)) {
    signal = deserializeAbortSignal(signal)
  }
  checkAbortSignal(signal)

  const { dataAdapter } = getAdapter(pluginManager, sessionId, adapterConfig)

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
    originalRegions,
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
async function comparativeRender(
  pluginManager,
  {
    sessionId,
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
    signal,
  })
  checkAbortSignal(signal)
  return result
}

window.rpcMethods = {
  getGlobalStats,
  getRegionStats,
  getMultiRegionStats,
  getRegions,
  getRefNames,
  getRefNameAliases,
  freeResources,
  render,
  comparativeRender,
}
