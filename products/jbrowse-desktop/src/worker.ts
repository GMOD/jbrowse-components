/* eslint-disable no-console */
import PluginManager from '@jbrowse/core/PluginManager'
import { remoteAbortRpcHandler } from '@jbrowse/core/rpc/remoteAbortSignals'
import { isAbortException } from '@jbrowse/core/util'
import { useStaticRendering } from 'mobx-react'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import PluginLoader, { PluginDefinition } from '@jbrowse/core/PluginLoader'
import corePlugins from './corePlugins'

const { electron, electronBetterIpc } = window
if (!electron) {
  throw new Error('Electron not available??')
}

const { ipcRenderer } = electronBetterIpc
if (!ipcRenderer) {
  throw new Error('IPC renderer not available??')
}

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

interface WorkerConfiguration {
  plugins: PluginDefinition[]
}

// waits for a message from the main thread containing our configuration,
// which must be sent on boot
function receiveConfiguration(): Promise<WorkerConfiguration> {
  return new Promise((resolve, reject) => {
    if (!ipcRenderer) {
      reject(new Error('ipcRenderer not ready'))
      return
    }
    ipcRenderer.answerRenderer('ready_for_configuration', () => true)
    // listen for the configuration
    ipcRenderer.answerRenderer(
      'configure',
      (configuration: WorkerConfiguration) => {
        resolve(configuration)
        return true
      },
    )
  })
}

async function getPluginManager() {
  if (jbPluginManager) {
    return jbPluginManager
  }
  // Load runtime plugins
  const config = await receiveConfiguration()
  const pluginLoader = new PluginLoader(config.plugins)
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load()
  const plugins = [...corePlugins.map(p => ({ plugin: p })), ...runtimePlugins]
  const pluginManager = new PluginManager(
    plugins.map(({ plugin: P }) => new P()),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()
  jbPluginManager = pluginManager
  return pluginManager
}

interface WrappedFuncArgs {
  rpcDriverClassName: string
  channel: string
  [key: string]: unknown
}

let callCounter = 0
function wrapForRpc(
  func: (args: unknown, rpcDriverClassName: string) => unknown,
  funcName: string = func.name,
) {
  return (args: WrappedFuncArgs) => {
    callCounter += 1
    const myId = callCounter
    // logBuffer.push(['rpc-call', myId, func.name, args])
    const retP = Promise.resolve()
      .then(() => getPluginManager())
      .then(() =>
        func(
          {
            ...args,
            statusCallback: (message: string) => {
              // @ts-ignore
              ipcRenderer.sendTo(
                mainWindow.webContents.id,
                args.channel,
                message,
              )
            },
          },
          args.rpcDriverClassName as string,
        ),
      )
      .catch(error => {
        if (isAbortException(error)) {
          // logBuffer.push(['rpc-abort', myId, func.name, args])
        } else {
          console.error('rpc-error', myId, funcName, error)
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
    if (!(rpcMethod instanceof RpcMethodType)) {
      throw new Error('invalid rpc method??')
    }

    rpcConfig[rpcMethod.name] = wrapForRpc(
      rpcMethod.execute.bind(rpcMethod),
      rpcMethod.name,
    )
  })

  const allMethods: { [methodName: string]: Function } = {
    ...rpcConfig,
    ...remoteAbortRpcHandler(),
    ping: () => {},
  }

  ipcRenderer.answerRenderer('ready', () => true)

  ipcRenderer.answerRenderer('call', (functionName, args /* , opts */) => {
    // TODO: implement opts.timeout
    if (!(functionName in allMethods)) {
      throw new Error(`function ${functionName} not found`)
    }
    const requestedFunc = allMethods[functionName]
    return requestedFunc(args)
  })
})
