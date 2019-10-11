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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call(functionName: string, filteredArgs?: any, options = {}): any {
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
}
