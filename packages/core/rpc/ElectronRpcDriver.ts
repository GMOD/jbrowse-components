import shortid from 'shortid'
import BaseRpcDriver, { RpcDriverConstructorArgs } from './BaseRpcDriver'
import PluginManager from '../PluginManager'
import { PluginDefinition } from '../PluginLoader'

declare global {
  interface Window {
    electronBetterIpc: {
      ipcRenderer?: import('electron-better-ipc-extra').RendererProcessIpc
    }
    electron?: import('electron').AllElectron
  }
}
const { electronBetterIpc = {}, electron } =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof window !== 'undefined' ? window : ({} as any)

interface ElectronRpcDriverConstructorArgs extends RpcDriverConstructorArgs {
  workerCreationChannel: string
}

async function wait(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

type WorkerBootConfig = { plugins: PluginDefinition[] }

class WindowWorkerHandle {
  private ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc

  private window: import('electron').BrowserWindow

  private config: WorkerBootConfig

  private ready = false

  constructor(
    ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc,
    window: import('electron').BrowserWindow,
    config: WorkerBootConfig,
  ) {
    this.ipcRenderer = ipcRenderer
    this.window = window
    this.config = config
  }

  destroy(): void {
    this.window.destroy()
  }

  // waits for a new worker to start, and then sends it its bootstrap configuration
  async setup() {
    if (!this.ready) {
      let readyForConfig = false
      while (!readyForConfig) {
        await wait(1000)
        readyForConfig = !!(await this.ipcRenderer.callRenderer(
          this.window,
          'ready_for_configuration',
        ))
      }

      const result = await this.ipcRenderer.callRenderer(
        this.window,
        'configure',
        this.config,
      )
      if (!result) {
        throw new Error('failed to configure worker')
      }
      this.ready = true
    }
  }

  async call(
    functionName: string,
    filteredArgs?: Record<string, unknown>,
    opts: { statusCallback?: (arg0: string) => void } = {},
  ): Promise<unknown> {
    await this.setup()

    const { statusCallback, ...rest } = opts
    const channel = `message-${shortid.generate()}`
    const listener = (_event: unknown, message: string) => {
      if (opts.statusCallback) {
        opts.statusCallback(message)
      }
    }
    this.ipcRenderer.on(channel, listener)
    const result = await this.ipcRenderer.callRenderer(
      this.window,
      'call',
      functionName,
      { ...filteredArgs, channel },
      rest,
    )
    this.ipcRenderer.removeListener(channel, listener)
    return result
  }
}

export default class ElectronRpcDriver extends BaseRpcDriver {
  name = 'ElectronRpcDriver'

  bootConfig: WorkerBootConfig

  channel: string

  constructor(
    args: ElectronRpcDriverConstructorArgs,
    bootConfig: WorkerBootConfig,
  ) {
    super(args)
    const { workerCreationChannel } = args

    this.bootConfig = bootConfig
    this.channel = workerCreationChannel
  }

  makeWorker(): WindowWorkerHandle {
    const { ipcRenderer } = electronBetterIpc
    if (!ipcRenderer) {
      throw new Error(
        'Cannot use ElectronRpcDriver without ipcRenderer from electron-better-ipc-extra',
      )
    }
    if (!electron) {
      throw new Error(
        'Cannot use ElectronRpcDriver without electron available globally',
      )
    }
    const electronRemote = electron.remote
    const workerId = ipcRenderer.sendSync(this.channel)
    const window = electronRemote.BrowserWindow.fromId(workerId)
    const worker = new WindowWorkerHandle(ipcRenderer, window, this.bootConfig)
    return worker
  }

  async call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: {},
    options = {},
  ): Promise<unknown> {
    const r = await super.call(
      pluginManager,
      sessionId,
      functionName,
      args,
      options,
    )

    if (typeof r === 'object' && r !== null && 'imageData' in r) {
      const img = new Image()
      // @ts-ignore
      img.src = r.imageData.dataURL
      // @ts-ignore
      r.imageData = img
    }
    return r
  }
}
