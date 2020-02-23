/* eslint-disable no-underscore-dangle */
import uri2path from 'file-uri-to-path'
import {
  Fetcher,
  FilehandleOptions,
  GenericFilehandle,
  PolyfilledResponse,
  Stats,
} from 'generic-filehandle'
import ElectronLocalFile from './ElectronLocalFile'
import { isAbortException } from '../index'

declare global {
  interface Window {
    electron?: import('electron').AllElectron
  }
}
const { electron } = window

class ElectronRemoteFileError extends Error {
  public status: number | undefined
}

interface SerializedResponse {
  buffer: Buffer
  url: string
  status: number
  statusText: string
  headers: string[][]
}

export default class ElectronRemoteFile implements GenericFilehandle {
  protected url: string

  protected _stat?: Stats

  protected fetch?: Fetcher

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected baseOverrides: any = {}

  private nodeFetchFallback = false

  private ipcRenderer: import('electron').IpcRenderer

  public constructor(source: string, opts: FilehandleOptions = {}) {
    let ipcRenderer
    if (electron) ipcRenderer = electron.ipcRenderer
    if (!ipcRenderer)
      throw new Error(
        'Cannot use ElectronLocalFile without ipcRenderer from electron',
      )
    this.ipcRenderer = ipcRenderer

    this.url = source

    // if it is a file URL, monkey-patch ourselves to act like a LocalFile
    if (source.startsWith('file://')) {
      const path = uri2path(source)
      if (!path) throw new TypeError('invalid file url')
      const localFile = new ElectronLocalFile(path)
      this.read = localFile.read.bind(localFile)
      this.readFile = localFile.readFile.bind(localFile)
      this.stat = localFile.stat.bind(localFile)
      return
    }

    const fetch = opts.fetch || window.fetch
    if (!fetch) {
      throw new TypeError(
        `no fetch function supplied, and none found in global environment`,
      )
    }
    this.fetch = fetch

    if (opts.overrides) {
      this.baseOverrides = opts.overrides
    }
  }

  private async getBufferFromResponse(
    response: PolyfilledResponse,
  ): Promise<Buffer> {
    if (typeof response.buffer === 'function') {
      return response.buffer()
    }
    if (typeof response.arrayBuffer === 'function') {
      const resp = await response.arrayBuffer()
      return Buffer.from(resp)
    }
    throw new TypeError(
      'invalid HTTP response object, has no buffer method, and no arrayBuffer method',
    )
  }

  private nodeFetch = async (
    input: RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    if (init) init.signal = undefined
    const serializedResponse = (await this.ipcRenderer.invoke(
      'fetch',
      input,
      init,
    )) as SerializedResponse
    const { buffer, headers, status, statusText } = serializedResponse
    const response = new Response(buffer, { status, statusText, headers })
    return response
  }

  protected async getFetch(
    opts: FilehandleOptions,
  ): Promise<PolyfilledResponse> {
    if (!this.fetch)
      throw new Error(
        'a fetch function must be available unless using a file:// url',
      )
    if (!this.url) throw new Error('no URL specified')
    const fetch = this.nodeFetchFallback ? this.nodeFetch : this.fetch
    const { headers = {}, signal, overrides = {} } = opts
    const requestOptions = {
      headers,
      method: 'GET',
      redirect: 'follow',
      mode: 'cors',
      signal,
      ...this.baseOverrides,
      ...overrides,
    }
    let response
    try {
      response = await fetch(this.url, requestOptions)
    } catch (error) {
      if (!isAbortException(error)) {
        if (this.nodeFetchFallback) {
          throw error
        }
        console.warn('received error, falling back to node-fetch', error)
        this.nodeFetchFallback = true
        return this.getFetch(opts)
      }
      // rethrow abort
      throw error
    }

    if (!this._stat) {
      // try to parse out the size of the remote file
      if (requestOptions.headers && requestOptions.headers.range) {
        const contentRange = response.headers.get('content-range')
        const sizeMatch = /\/(\d+)$/.exec(contentRange || '')
        if (sizeMatch && sizeMatch[1])
          this._stat = { size: parseInt(sizeMatch[1], 10) }
      } else {
        const contentLength = response.headers.get('content-length')
        if (contentLength) this._stat = { size: parseInt(contentLength, 10) }
      }
    }
    return response
  }

  protected async headFetch(): Promise<PolyfilledResponse> {
    return this.getFetch({ overrides: { method: 'HEAD' } })
  }

  public async read(
    buffer: Buffer,
    offset = 0,
    length: number,
    position = 0,
    opts: FilehandleOptions = {},
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    opts.headers = opts.headers || {}
    if (length < Infinity) {
      opts.headers.range = `bytes=${position}-${position + length}`
    } else if (length === Infinity && position !== 0) {
      opts.headers.range = `bytes=${position}-`
    }

    const response = await this.getFetch(opts)
    if (
      (response.status === 200 && position === 0) ||
      response.status === 206
    ) {
      const responseData = await this.getBufferFromResponse(response)
      const bytesCopied = responseData.copy(
        buffer,
        offset,
        0,
        Math.min(length, responseData.length),
      )

      return { bytesRead: bytesCopied, buffer }
    }

    // TODO: try harder here to gather more information about what the problem is
    throw new Error(`HTTP ${response.status} fetching ${this.url}`)
  }

  public async readFile(
    options: FilehandleOptions | string = {},
  ): Promise<Buffer | string> {
    let encoding
    let opts
    if (typeof options === 'string') {
      encoding = options
      opts = {}
    } else {
      encoding = options.encoding
      opts = options
      delete opts.encoding
    }
    const response = await this.getFetch(opts)
    if (response.status !== 200) {
      const err = new ElectronRemoteFileError(
        `HTTP ${response.status} fetching ${this.url}`,
      )
      err.status = response.status
      throw err
    }
    if (encoding === 'utf8') {
      return response.text()
    }
    if (encoding) {
      throw new Error(`unsupported encoding: ${encoding}`)
    }
    return this.getBufferFromResponse(response)
  }

  public async stat(): Promise<Stats> {
    if (!this._stat) await this.headFetch()
    if (!this._stat) await this.read(Buffer.allocUnsafe(10), 0, 10, 0)
    if (!this._stat)
      throw new Error(`unable to determine size of file at ${this.url}`)
    return this._stat
  }
}
