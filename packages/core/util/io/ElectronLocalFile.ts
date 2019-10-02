import { GenericFilehandle, FilehandleOptions } from 'generic-filehandle'

declare global {
  interface Window {
    electronBetterIpc: {
      ipcRenderer: import('electron-better-ipc').RendererProcessIpc
    }
  }
}
const { electronBetterIpc } = window
const { ipcRenderer } = electronBetterIpc

export default class ElectronLocalFile implements GenericFilehandle {
  private filename: import('fs').PathLike

  private fd?: Promise<number>

  constructor(source: import('fs').PathLike) {
    this.filename = source
  }

  private async getFd(): Promise<number> {
    if (!this.fd)
      this.fd = ipcRenderer.callMain('open', [this.filename, 'r']) as Promise<
        number
      >
    return this.fd as Promise<number>
  }

  async read(
    buffer: Buffer,
    offset = 0,
    length: number,
    position = 0,
  ): Promise<{ buffer: Buffer; bytesRead: number }> {
    const fetchLength = Math.min(buffer.length - offset, length)
    const fd = await this.getFd()
    const res = (await ipcRenderer.callMain('read', [
      fd,
      buffer,
      offset,
      fetchLength,
      position,
    ])) as { buffer: Buffer; bytesRead: number }
    res.buffer = Buffer.from(res.buffer)
    return res
  }

  async readFile(options: FilehandleOptions): Promise<Buffer | string> {
    return ipcRenderer.callMain('readFile', [
      this.filename,
      options,
    ]) as Promise<Buffer | string>
  }

  // todo memoize
  async stat(): Promise<import('fs').Stats> {
    return ipcRenderer.callMain('stat', [await this.getFd()]) as Promise<
      import('fs').Stats
    >
  }
}
