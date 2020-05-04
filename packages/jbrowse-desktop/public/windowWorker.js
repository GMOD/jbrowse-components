const { electronBetterIpc, rpcMethods, rpcStuff } = window

const { ipcRenderer } = electronBetterIpc

const {
  useStaticRendering,
  PluginManager,
  remoteAbortRpcHandler,
  isAbortException,
  corePlugins,
} = rpcStuff

// eslint-disable-next-line react-hooks/rules-of-hooks
useStaticRendering(true)

let jbPluginManager

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

const logBuffer = []
function flushLog() {
  if (logBuffer.length) {
    for (const l of logBuffer) {
      const [head, ...rest] = l
      if (head === 'rpc-error') {
        console.error(head, ...rest)
      } else {
        // eslint-disable-next-line no-console
        console.log(head, ...rest)
      }
    }
    logBuffer.length = 0
  }
}
setInterval(flushLog, 1000)

let callCounter = 0
function wrapForRpc(func) {
  return args => {
    callCounter += 1
    const myId = callCounter
    // logBuffer.push(['rpc-call', myId, func.name, args])
    const retP = Promise.resolve()
      .then(() => getPluginManager())
      .then(pluginManager => func(pluginManager, args))
      .catch(error => {
        if (isAbortException(error)) {
          // logBuffer.push(['rpc-abort', myId, func.name, args])
        } else {
          logBuffer.push(['rpc-error', myId, func.name, error])
          flushLog()
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

const wrappedRpcMethods = {}

Object.keys(rpcMethods).forEach(key => {
  wrappedRpcMethods[key] = wrapForRpc(rpcMethods[key])
})

ipcRenderer.answerRenderer('ready', () => true)

ipcRenderer.answerRenderer('call', (functionName, args /* , opts */) => {
  // TODO: implement opts.timeout
  return { ...wrappedRpcMethods, ...remoteAbortRpcHandler(), ping: () => {} }[
    functionName
  ](args)
})
