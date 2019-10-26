import BaseRpcDriver from './BaseRpcDriver'

declare global {
  interface Window {
    electronBetterIpc: {
      ipcRenderer?: import('electron-better-ipc-extra').RendererProcessIpc
    }
    electron?: import('electron').AllElectron
  }
}
const { electronBetterIpc = {}, electron } = window

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

  async wait(ms: number): Promise<void> {
    return new Promise((resolve): void => {
      setTimeout(resolve, ms)
    })
  }

  destroy(): void {
    this.window.destroy()
  }

  async call(
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filteredArgs?: any,
    options = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    // The window can have been created, but still not be ready, and any
    // `callRenderer` call to that window just returns Promise<undefined>
    // instead of an error, which makes failures hard to track down. For now
    // we'll just wait until it's ready until we find a better option.
    while (!this.ready) {
      // eslint-disable-next-line no-await-in-loop
      await this.wait(1000)
      // eslint-disable-next-line no-await-in-loop
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

  constructor({ workerCreationChannel }: { workerCreationChannel: string }) {
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
      return new WindowWorkerHandle(ipcRenderer, window)
    }
  }

  call(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginManager: any,
    stateGroupName: string,
    functionName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args: any,
    options = {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    return (
      super
        .call(pluginManager, stateGroupName, functionName, args, options)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((r: any) => {
          if (r && r.imageData) {
            const img = new Image()
            img.src = r.imageData.dataURL
            r.imageData = img
          }
          return r
        })
    )
  }
}
