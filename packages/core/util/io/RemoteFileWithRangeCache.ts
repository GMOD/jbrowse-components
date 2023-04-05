import { HttpRangeFetcher } from 'http-range-fetcher'
import { Buffer } from 'buffer'
import { RemoteFile, PolyfilledResponse } from 'generic-filehandle'

type BinaryRangeFetch = (
  url: string,
  start: number,
  end: number,
  options?: { headers?: HeadersInit; signal?: AbortSignal },
) => Promise<BinaryRangeResponse>

export interface BinaryRangeResponse {
  headers: Record<string, string>
  requestDate: Date
  responseDate: Date
  buffer: Buffer
}

const fetchers: Record<string, BinaryRangeFetch> = {}

function binaryRangeFetch(
  url: string,
  start: number,
  end: number,
  options: { headers?: HeadersInit; signal?: AbortSignal } = {},
): Promise<BinaryRangeResponse> {
  const fetcher = fetchers[url]
  if (!fetcher) {
    throw new Error(`fetch not registered for ${url}`)
  }
  return fetcher(url, start, end, options)
}

const globalRangeCache = new HttpRangeFetcher({
  fetch: binaryRangeFetch,
  size: 500 * 1024 ** 2, // 500MiB
  chunkSize: 128 * 124, // 128KiB
  maxFetchSize: 100 * 1024 ** 2, // 100MiB
  minimumTTL: 24 * 60 * 60 * 1000, // 1 day
})

export function clearCache() {
  globalRangeCache.reset()
}

export class RemoteFileWithRangeCache extends RemoteFile {
  public async fetch(
    url: RequestInfo,
    init?: RequestInit,
  ): Promise<PolyfilledResponse> {
    if (!fetchers[String(url)]) {
      fetchers[String(url)] = this.fetchBinaryRange.bind(this)
    }
    // if it is a range request, route it through the range cache
    const requestHeaders = init && init.headers
    let range
    if (requestHeaders) {
      if (requestHeaders instanceof Headers) {
        range = requestHeaders.get('range')
      } else if (Array.isArray(requestHeaders)) {
        ;[, range] = requestHeaders.find(([key]) => key === 'range') || [
          undefined,
          undefined,
        ]
      } else {
        range = requestHeaders.range
      }
    }
    if (range) {
      const rangeParse = /bytes=(\d+)-(\d+)/.exec(range)
      if (rangeParse) {
        const [, start, end] = rangeParse
        const s = Number.parseInt(start, 10)
        const e = Number.parseInt(end, 10)
        const response = (await globalRangeCache.getRange(url, s, e - s + 1, {
          signal: init && init.signal,
        })) as BinaryRangeResponse
        const { headers } = response
        return new Response(response.buffer, { status: 206, headers })
      }
    }
    return super.fetch(url, init)
  }

  public async fetchBinaryRange(
    url: string,
    start: number,
    end: number,
    options: { headers?: HeadersInit; signal?: AbortSignal } = {},
  ): Promise<BinaryRangeResponse> {
    const requestDate = new Date()
    const requestHeaders = {
      ...options.headers,
      range: `bytes=${start}-${end}`,
    }
    const res = await super.fetch(url, {
      ...options,
      headers: requestHeaders,
    })
    const responseDate = new Date()
    if (res.status !== 206) {
      const errorMessage = `HTTP ${res.status} (${res.statusText}) when fetching ${url} bytes ${start}-${end}`
      const hint = ' (should be 206 for range requests)'
      throw new Error(`${errorMessage}${res.status === 200 ? hint : ''}`)
    }

    // translate the Headers object into a regular key -> value object.
    // will miss duplicate headers of course
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers: Record<string, any> = {}
    for (const [k, v] of res.headers.entries()) {
      headers[k] = v
    }

    // return the response headers, and the data buffer
    const arrayBuffer = await res.arrayBuffer()
    return {
      headers,
      requestDate,
      responseDate,
      buffer: Buffer.from(arrayBuffer),
    }
  }
}
