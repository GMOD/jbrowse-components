/* eslint-disable no-await-in-loop */
import BaseRpcDriver from './BaseRpcDriver'
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
const { electronBetterIpc = {}, electron } = window

async function wait(ms: number): Promise<void> {
  return new Promise((resolve): void => {
    setTimeout(resolve, ms)
  })
}

class WindowWorkerHandle {
  private ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc

  private window: import('electron').BrowserWindow

  private ready = false

  constructor(
    ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc,
    window: import('electron').BrowserWindow,
  ) {
    this.ipcRenderer = ipcRenderer
    this.window = window
  }

  destroy(): void {
    this.window.destroy()
  }

  async call(
    functionName: string,
    filteredArgs?: unknown,
    options = {},
  ): Promise<unknown> {
    // The window can have been created, but still not be ready, and any
    // `callRenderer` call to that window just returns Promise<undefined>
    // instead of an error, which makes failures hard to track down. For now
    // we'll just wait until it's ready until we find a better option.
    while (!this.ready) {
      await wait(1000)
      this.ready = !!(await this.ipcRenderer.callRenderer(this.window, 'ready'))
    }
    return this.ipcRenderer.callRenderer(
      this.window,
      'call',
      functionName,
      filteredArgs,
      options,
    )
  }
}

export default class ElectronRpcDriver extends BaseRpcDriver {
  makeWorker: () => WindowWorkerHandle

  constructor(
    { workerCreationChannel }: { workerCreationChannel: string },
    workerBootConfiguration: { plugins: PluginDefinition[] },
  ) {
    super()
    if (!electron)
      throw new Error(
        'Cannot use ElectronRpcDriver without electron available globally',
      )
    const electronRemote = electron.remote
    const { ipcRenderer } = electronBetterIpc
    if (!ipcRenderer)
      throw new Error(
        'Cannot use ElectronRpcDriver without ipcRenderer from electron-better-ipc-extra',
      )

    this.makeWorker = (): WindowWorkerHandle => {
      const workerId = ipcRenderer.sendSync(workerCreationChannel)
      const window = electronRemote.BrowserWindow.fromId(workerId)
      const worker = new WindowWorkerHandle(ipcRenderer, window)
      // out of band, take care of booting the worker
      this.bootWorker(ipcRenderer, window, workerBootConfiguration).catch(
        error => {
          console.error('worker failed to boot')
          console.error(error)
        },
      )
      return worker
    }
  }

  // waits for a new worker to start, and then sends it its bootstrap configuration
  async bootWorker(
    ipcRenderer: NonNullable<typeof electronBetterIpc.ipcRenderer>,
    window: Electron.BrowserWindow,
    workerBootConfiguration: { plugins: PluginDefinition[] },
  ) {
    let readyForConfig = false
    while (!readyForConfig) {
      await wait(1000)
      readyForConfig = !!(await ipcRenderer.callRenderer(
        window,
        'ready_for_configuration',
      ))
    }

    const result = await ipcRenderer.callRenderer(
      window,
      'configure',
      workerBootConfiguration,
    )
    if (!result) throw new Error('failed to configure worker')
  }

  call(
    pluginManager: PluginManager,
    sessionId: string,
    functionName: string,
    args: {},
    options = {},
  ): Promise<unknown> {
    return super
      .call(pluginManager, sessionId, functionName, args, options)
      .then(r => {
        if (typeof r === 'object' && r !== null && 'imageData' in r) {
          const img = new Image()
          // @ts-ignore
          img.src = r.imageData.dataURL
          // @ts-ignore
          r.imageData = img
        }
        return r
      })
  }
}
