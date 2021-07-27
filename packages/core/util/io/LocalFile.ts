import { GenericFilehandle, FilehandleOptions } from 'generic-filehandle'

export default class LocalFile implements GenericFilehandle {
  private fdPromise?: Promise<number>
  private filename: string
  private fsOpenPromise: Promise<typeof import('fs').open.__promisify__>
  private fsReadPromise: Promise<typeof import('fs').read.__promisify__>
  private fsReadFilePromise: Promise<typeof import('fs').readFile.__promisify__>
  private fsStatPromise: Promise<typeof import('fs').stat.__promisify__>

  public constructor(source: string, _opts: FilehandleOptions = {}) {
    this.filename = source
    const utilPromise = import('util')
    const fsPromise = import('fs')
    this.fsOpenPromise = Promise.all([
      utilPromise,
      fsPromise,
    ]).then(([util, fs]) => util.promisify(fs.open))
    this.fsReadPromise = Promise.all([
      utilPromise,
      fsPromise,
    ]).then(([util, fs]) => util.promisify(fs.read))
    this.fsReadFilePromise = Promise.all([
      utilPromise,
      fsPromise,
    ]).then(([util, fs]) => util.promisify(fs.readFile))
    this.fsStatPromise = Promise.all([
      utilPromise,
      fsPromise,
    ]).then(([util, fs]) => util.promisify(fs.stat))
  }

  private async getFd(): Promise<number> {
    if (!this.fdPromise) {
      this.fdPromise = (await this.fsOpenPromise)(this.filename, 'r')
    }
    return this.fdPromise
  }

  public async read(
    buffer: Buffer,
    offset = 0,
    length: number,
    position = 0,
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    const fetchLength = Math.min(buffer.length - offset, length)
    const fd = await this.getFd()
    return (await this.fsReadPromise)(fd, buffer, offset, fetchLength, position)
  }

  public async readFile(
    options?: FilehandleOptions | string,
  ): Promise<Buffer | string> {
    return (await this.fsReadFilePromise)(
      this.filename,
      options as BufferEncoding,
    )
  }
  // todo memoize
  public async stat(): Promise<import('fs').Stats> {
    return (await this.fsStatPromise)(this.filename)
  }
}
