import 'whatwg-fetch'
// import tenaciousFetch from 'tenacious-fetch'

import { HttpRangeFetcher } from 'http-range-fetcher'
import { Buffer } from 'buffer'
import { RemoteFile, GenericFilehandle } from 'generic-filehandle'

// function unReplacePath() {
//   throw new Error('unimplemented') // TODO
// }

function getfetch(url: RequestInfo, opts: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    // retries: 5,
    // retryDelay: 1000, // 1 sec, 2 sec, 3 sec
    // retryStatus: [500, 404, 503],
    // onRetry: ({ retriesLeft }: { retriesLeft: number }) => {
    //   console.warn(
    //     `${url} request failed, retrying (${retriesLeft} retries left)`,
    //   )
    // },
    ...opts,
  })
}

async function fetchBinaryRange(
  url: string,
  start: number,
  end: number,
  options: { headers?: HeadersInit; signal?: AbortSignal } = {},
) {
  const requestDate = new Date()
  const requestHeaders = { ...options.headers, range: `bytes=${start}-${end}` }
  const res = await getfetch(url, {
    ...options,
    headers: requestHeaders,
    // onRetry: ({ retriesLeft }: { retriesLeft: number }) => {
    //   console.warn(
    //     `${url} bytes ${start}-${end} request failed, retrying (${retriesLeft} retries left)`,
    //   )
    // },
  })
  const responseDate = new Date()
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(
      `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
    )
  }

  // translate the Headers object into a regular key -> value object.
  // will miss duplicate headers of course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headers: Record<string, any> = {}
  for (const [k, v] of res.headers.entries()) {
    headers[k] = v
  }

  if (res.status === 200) {
    throw new Error(
      `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
    )
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

const globalRangeCache = new HttpRangeFetcher({
  fetch: fetchBinaryRange,
  size: 100 * 1024 * 1024, // 100MB
  chunkSize: 2 ** 16, // 64KB
  aggregationTime: 500,
  minimumTTL: 300000000,
})

async function globalCacheFetch(
  url: RequestInfo,
  opts?: RequestInit,
): Promise<Response> {
  // if it is a range request, route it through the global range cache
  const requestHeaders = opts && opts.headers
  let range
  if (requestHeaders) {
    if (requestHeaders instanceof Headers) range = requestHeaders.get('range')
    else if (Array.isArray(requestHeaders))
      [, range] = requestHeaders.find(([key]) => key === 'range') || [
        undefined,
        undefined,
      ]
    else range = requestHeaders.range
  }
  if (range) {
    const rangeParse = /bytes=(\d+)-(\d+)/.exec(range)
    if (rangeParse) {
      const [, start, end] = rangeParse
      const s = parseInt(start, 10)
      const e = parseInt(end, 10)
      const response = await (globalRangeCache.getRange(url, s, e - s + 1, {
        signal: opts && opts.signal,
      }) as ReturnType<typeof fetchBinaryRange>)
      const { headers } = response
      return new Response(response.buffer, { status: 206, headers })
    }
  }

  return getfetch(url, opts)
}
export function clearCache() {
  globalRangeCache.reset()
}

export function openUrl(url: string): GenericFilehandle {
  return new RemoteFile(String(url), {
    fetch: globalCacheFetch,
  })
}
