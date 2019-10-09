const { electronBetterIpc, rpcMethods, rpcStuff } = window

const { ipcRenderer } = electronBetterIpc

const {
  useStaticRendering,
  PluginManager,
  remoteAbortRpcHandler,
  // isAbortException,
  corePlugins,
} = rpcStuff

// eslint-disable-next-line react-hooks/rules-of-hooks
useStaticRendering(true)

const jbPluginManager = new PluginManager(corePlugins.map(P => new P()))
jbPluginManager.configure()

ipcRenderer.answerRenderer('ping', async () => {})

ipcRenderer.answerRenderer('call', async (functionName, args /* , opts */) => {
  // TODO: implement opts.timeout
  return { ...rpcMethods, ...remoteAbortRpcHandler() }[functionName](
    jbPluginManager,
    args,
  )
})
