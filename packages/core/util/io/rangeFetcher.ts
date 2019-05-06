import 'whatwg-fetch'
// import tenaciousFetch from 'tenacious-fetch'

import { HttpRangeFetcher } from 'http-range-fetcher'
import { Buffer } from 'buffer'
import { RemoteFile } from 'generic-filehandle'

function isElectron() {
  return false // TODO
}

// function unReplacePath() {
//   throw new Error('unimplemented') // TODO
// }

function getfetch(url, opts = {}) {
  let mfetch
  if (isElectron()) {
    if (url.slice(0, 4) === 'http') {
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
        onRetry: ({ retriesLeft /* , retryDelay  */ }) => {
          console.warn(
            `${url} request failed, retrying (${retriesLeft} retries left)`,
          )
        },
      },
      opts,
    ),
  )
}

async function fetchBinaryRange(url, start, end) {
  const requestDate = new Date()
  const requestHeaders = {
    headers: { range: `bytes=${start}-${end}` },
    onRetry: ({ retriesLeft /* , retryDelay */ }) => {
      console.warn(
        `${url} bytes ${start}-${end} request failed, retrying (${retriesLeft} retries left)`,
      )
    },
  }
  const res = await getfetch(url, requestHeaders)
  const responseDate = new Date()
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(
      `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
    )
  }

  // translate the Headers object into a regular key -> value object.
  // will miss duplicate headers of course
  const headers = {}
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
  chunkSize: 2 ** 18, // 256KB
  aggregationTime: 50,
})

// export default globalCache

function globalCacheFetch(url, opts) {
  // if (/2bit/.test(url)) debugger

  // if it is a range request, route it through the global range cache
  if (opts && opts.headers && opts.headers.range) {
    const rangeParse = /bytes=(\d+)-(\d+)/.exec(opts.headers.range)
    if (rangeParse) {
      let [, start, end] = rangeParse
      start = parseInt(start, 10)
      end = parseInt(end, 10)
      return globalRangeCache
        .getRange(url, start, end - start + 1, {
          signal: opts.signal,
        })
        .then(response => {
          let { headers } = response
          if (!(headers instanceof Map)) {
            headers = new Map(Object.entries(headers))
          }
          return {
            status: 206,
            ok: true,
            async arrayBuffer() {
              return response.buffer
            },
            headers,
          }
        })
    }
  }

  return getfetch(url, opts)
}

// eslint-disable-next-line import/prefer-default-export
export function openUrl(url): GenericFilehandle {
  return new RemoteFile(String(url), {
    fetch: globalCacheFetch,
  })
}
