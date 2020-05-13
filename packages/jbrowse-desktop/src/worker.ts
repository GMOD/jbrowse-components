/* eslint-disable import/no-extraneous-dependencies,no-console,no-underscore-dangle */
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { remoteAbortRpcHandler } from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { isAbortException } from '@gmod/jbrowse-core/util'
import {} from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import { useStaticRendering } from 'mobx-react'
import RpcMethodType from '@gmod/jbrowse-core/pluggableElementTypes/RpcMethodType'
import corePlugins from './corePlugins'

const { electron, electronBetterIpc } = window
if (!electron) throw new Error('Electron not available??')

const { ipcRenderer } = electronBetterIpc
if (!ipcRenderer) throw new Error('IPC renderer not available??')

let mainWindow: Electron.BrowserWindow

const originalConsoleLog = console.log.bind(console)
console.log = async (...args: unknown[]) => {
  if (!mainWindow) {
    const mainWindowId = await ipcRenderer.invoke('getMainWindowId')
    mainWindow = electron.remote.BrowserWindow.fromId(mainWindowId)
  }
  ipcRenderer.sendTo(mainWindow.webContents.id, 'consoleLog', ...args)
  originalConsoleLog(...args)
}

const originalConsoleWarn = console.warn.bind(console)
console.warn = async (...args: unknown[]) => {
  if (!mainWindow) {
    const mainWindowId = await ipcRenderer.invoke('getMainWindowId')
    mainWindow = electron.remote.BrowserWindow.fromId(mainWindowId)
  }
  ipcRenderer.sendTo(mainWindow.webContents.id, 'consoleWarn', ...args)
  originalConsoleWarn(...args)
}

const originalConsoleError = console.error.bind(console)
console.error = async (...args: unknown[]) => {
  if (!mainWindow) {
    const mainWindowId = await ipcRenderer.invoke('getMainWindowId')
    mainWindow = electron.remote.BrowserWindow.fromId(mainWindowId)
  }
  ipcRenderer.sendTo(mainWindow.webContents.id, 'consoleError', ...args)
  originalConsoleError(...args)
}

// eslint-disable-next-line react-hooks/rules-of-hooks
useStaticRendering(true)

let jbPluginManager: PluginManager

async function getPluginManager() {
  if (jbPluginManager) {
    return jbPluginManager
  }
  // TODO: Runtime plugins
  // Loading runtime plugins will look something like this
  // const pluginLoader = new PluginLoader(config.plugins)
  // const runtimePlugins = await pluginLoader.load()
  // const plugins = [...corePlugins, ...runtimePlugins]
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
  pluginManager.createPluggableElements()
  pluginManager.configure()
  jbPluginManager = pluginManager
  return pluginManager
}

let callCounter = 0
function wrapForRpc(func: Function) {
  return (args: unknown) => {
    callCounter += 1
    const myId = callCounter
    // logBuffer.push(['rpc-call', myId, func.name, args])
    const retP = Promise.resolve()
      .then(() => getPluginManager())
      .then(pluginManager => func(args))
      .catch(error => {
        if (isAbortException(error)) {
          // logBuffer.push(['rpc-abort', myId, func.name, args])
        } else {
          console.error('rpc-error', myId, func.name, error)
        }
        throw error
      })

    // uncomment below to log returns
    // retP.then(
    //   result => logBuffer.push(['rpc-return', myId, func.name, result]),
    //   err => {},
    // )

    return retP
  }
}

getPluginManager().then(pluginManager => {
  const rpcConfig: { [methodName: string]: Function } = {}
  const rpcMethods = pluginManager.getElementTypesInGroup('rpc method')
  rpcMethods.forEach(rpcMethod => {
    if (!(rpcMethod instanceof RpcMethodType))
      throw new Error('invalid rpc method??')

    rpcConfig[rpcMethod.name] = wrapForRpc(rpcMethod.execute.bind(rpcMethod))
  })

  const allMethods: { [methodName: string]: Function } = {
    ...rpcConfig,
    ...remoteAbortRpcHandler(),
    ping: () => {},
  }

  ipcRenderer.answerRenderer('ready', () => true)

  ipcRenderer.answerRenderer('call', (functionName, args /* , opts */) => {
    // TODO: implement opts.timeout
    if (!(functionName in allMethods))
      throw new Error(`function ${functionName} not found`)
    const requestedFunc = allMethods[functionName]
    return requestedFunc(args)
  })
})
