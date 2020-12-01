import { GenericFilehandle, FilehandleOptions } from 'generic-filehandle'

declare global {
  interface Window {
    electron?: import('electron').AllElectron
  }
}
const { electron } = window

type PathLike = import('fs').PathLike
type Stats = import('fs').Stats

export default class ElectronLocalFile implements GenericFilehandle {
  private filename: PathLike

  private fd?: Promise<number>

  private ipcRenderer: import('electron').IpcRenderer

  constructor(source: PathLike) {
    let ipcRenderer
    if (electron) ipcRenderer = electron.ipcRenderer
    if (!ipcRenderer)
      throw new Error(
        'Cannot use ElectronLocalFile without ipcRenderer from electron',
      )
    this.ipcRenderer = ipcRenderer
    this.filename = source
  }

  private async getFd(): Promise<number> {
    if (!this.filename) throw new Error('no file path specified')
    if (!this.fd)
      this.fd = this.ipcRenderer.invoke('open', this.filename, 'r') as Promise<
        number
      >
    return this.fd
  }

  async read(
    buffer: Buffer,
    offset = 0,
    length: number,
    position = 0,
  ): Promise<{ buffer: Buffer; bytesRead: number }> {
    const fetchLength = Math.min(buffer.length - offset, length)
    const fd = await this.getFd()
    const res = (await this.ipcRenderer.invoke(
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

  async readFile(_: FilehandleOptions = {}): Promise<Buffer | string> {
    if (!this.filename) throw new Error('no file path specified')

    const result = await this.ipcRenderer.invoke('readFile', this.filename)

    return result.byteLength !== undefined ? Buffer.from(result) : result
  }

  // todo memoize
  async stat(): Promise<Stats> {
    return this.ipcRenderer.invoke('stat', await this.getFd()) as Promise<Stats>
  }
}
