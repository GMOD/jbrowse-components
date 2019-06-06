import 'whatwg-fetch'
// import tenaciousFetch from 'tenacious-fetch'

import { HttpRangeFetcher } from 'http-range-fetcher'
import { Buffer } from 'buffer'
import { RemoteFile, GenericFilehandle } from 'generic-filehandle'

function isElectron(): boolean {
  return false // TODO
}

// function unReplacePath() {
//   throw new Error('unimplemented') // TODO
// }
interface FetchResponse {
  status: number
  headers: Headers
  arrayBuffer: Function
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getfetch(
  url: string,
  opts: Record<string, any> = {},
): Promise<FetchResponse> {
  let mfetch
  if (isElectron()) {
    if (url.slice(0, 4) === 'http') {
      // @ts-ignore
      mfetch = window.electronRequire('node-fetch')
    } else {
      url = url.replace('%20', ' ')
      mfetch = fetch
    }
  } else {
    mfetch = window.fetch
  }
  return mfetch(
    url,
    Object.assign(
      {
        method: 'GET',
        credentials: 'same-origin',
        retries: 5,
        retryDelay: 1000, // 1 sec, 2 sec, 3 sec
        retryStatus: [500, 404, 503],
        onRetry: ({ retriesLeft }: { retriesLeft: number }) => {
          console.warn(
            `${url} request failed, retrying (${retriesLeft} retries left)`,
          )
        },
      },
      opts,
    ),
  )
}
export interface RangeResponse {
  headers: Headers
  requestDate: Date
  responseDate: Date
  buffer: Buffer
}

async function fetchBinaryRange(
  url: string,
  start: number,
  end: number,
  options: { headers?: HeadersInit; signal?: AbortSignal } = {},
): Promise<RangeResponse> {
  const requestDate = new Date()
  const requestHeaders = { ...options.headers, range: `bytes=${start}-${end}` }
  const res = await getfetch(url, {
    ...options,
    headers: requestHeaders,
    onRetry: ({ retriesLeft }: { retriesLeft: number }) => {
      console.warn(
        `${url} bytes ${start}-${end} request failed, retrying (${retriesLeft} retries left)`,
      )
    },
  })
  const responseDate = new Date()
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(
      `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
    )
  }

  if (res.status === 200) {
    throw new Error(
      `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
    )
  }

  // return the response headers, and the data buffer
  const arrayBuffer = await res.arrayBuffer()
  return {
    headers: res.headers,
    requestDate,
    responseDate,
    buffer: Buffer.from(arrayBuffer),
  }
}

const globalRangeCache = new HttpRangeFetcher({
  fetch: fetchBinaryRange,
  size: 100 * 1024 * 1024, // 100MB
  chunkSize: 2 ** 16, // 64KB
  aggregationTime: 50,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function globalCacheFetch(
  url: string,
  opts: { headers?: Record<string, any>; signal?: AbortSignal },
): Promise<FetchResponse> {
  // if it is a range request, route it through the global range cache
  if (opts && opts.headers && opts.headers.range) {
    const rangeParse = /bytes=(\d+)-(\d+)/.exec(opts.headers.range)
    if (rangeParse) {
      const [, start, end] = rangeParse
      const s = parseInt(start, 10)
      const e = parseInt(end, 10)
      return globalRangeCache
        .getRange(url, s, e - s + 1, {
          signal: opts.signal,
        })
        .then((response: RangeResponse) => {
          return {
            status: 206,
            ok: true,
            async arrayBuffer() {
              return response.buffer
            },
            headers: response.headers,
          }
        })
    }
  }

  return getfetch(url, opts)
}

// eslint-disable-next-line import/prefer-default-export
export function openUrl(url: string): GenericFilehandle {
  return new RemoteFile(String(url), {
    fetch: globalCacheFetch,
  })
}
