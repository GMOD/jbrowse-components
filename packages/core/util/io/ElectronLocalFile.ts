import { GenericFilehandle, FilehandleOptions } from 'generic-filehandle'

declare global {
  interface Window {
    electronBetterIpc: {
      ipcRenderer?: import('electron-better-ipc-extra').RendererProcessIpc
    }
  }
}
const { electronBetterIpc = {} } = window
const { ipcRenderer } = electronBetterIpc

type PathLike = import('fs').PathLike
type Stats = import('fs').Stats

export default class ElectronLocalFile implements GenericFilehandle {
  private filename: PathLike

  private fd?: Promise<number>

  private ipcRenderer: import('electron-better-ipc-extra').RendererProcessIpc

  constructor(source: PathLike) {
    if (!ipcRenderer)
      throw new Error(
        'Cannot use ElectronLocalFile without ipcRenderer from electron-better-ipc-extra',
      )
    this.ipcRenderer = ipcRenderer
    this.filename = source
  }

  private async getFd(): Promise<number> {
    if (!this.fd)
      this.fd = this.ipcRenderer.callMain(
        'open',
        this.filename,
        'r',
      ) as Promise<number>
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
    const res = (await this.ipcRenderer.callMain(
      'read',
      fd,
      buffer,
      offset,
      fetchLength,
      position,
    )) as { buffer: Buffer; bytesRead: number }
    // TODO: This looks like a buffer, but fails Buffer.isBuffer(), so we have
    // to coerce it. Why?
    res.buffer = Buffer.from(res.buffer)
    // Copy into input buffer to match node's fs.promises.read() behavior.
    res.buffer.copy(buffer)
    return res
  }

  async readFile(options: FilehandleOptions): Promise<Buffer | string> {
    return this.ipcRenderer.callMain(
      'readFile',
      this.filename,
      options,
    ) as Promise<Buffer | string>
  }

  // todo memoize
  async stat(): Promise<Stats> {
    return this.ipcRenderer.callMain('stat', await this.getFd()) as Promise<
      Stats
    >
  }
}
