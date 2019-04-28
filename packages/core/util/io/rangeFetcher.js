import 'whatwg-fetch'
import tenaciousFetch from 'tenacious-fetch'

// import { HttpRangeFetcher } from 'http-range-fetcher'
// import { Buffer } from 'buffer'
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
    mfetch = tenaciousFetch
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

// function fetchBinaryRange(url, start, end) {
//   const requestDate = new Date()
//   const requestHeaders = {
//     headers: { range: `bytes=${start}-${end}` },
//     onRetry: ({ retriesLeft /* , retryDelay */ }) => {
//       console.warn(
//         `${url} bytes ${start}-${end} request failed, retrying (${retriesLeft} retries left)`,
//       )
//     },
//   }
//   return getfetch(url, requestHeaders).then(
//     (res) => {
//       const responseDate = new Date()
//       if (res.status !== 206 && res.status !== 200) {
//         throw new Error(
//           `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
//         )
//       }

//       // translate the Headers object into a regular key -> value object.
//       // will miss duplicate headers of course
//       const headers = {}
//       for (const [k, v] of res.headers.entries()) {
//         headers[k] = v
//       }

//       if (isElectron()) {
//         // electron charmingly returns HTTP 200 for byte range requests,
//         // and does not fill in content-range. so we will fill it in
//         try {
//           if (!headers['content-range']) {
//             const fs = window.electronRequire('fs') // Load the filesystem module
//             const stats = fs.statSync(unReplacePath(url))
//             headers['content-range'] = `${start}-${end}/${stats.size}`
//           }
//         } catch (e) {
//           console.warn('Could not get size of file', url, e)
//         }
//       } else if (res.status === 200) {
//         throw new Error(
//           `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
//         )
//       }

//       // return the response headers, and the data buffer
//       return res.arrayBuffer().then(arrayBuffer => ({
//         headers,
//         requestDate,
//         responseDate,
//         buffer: Buffer.from(arrayBuffer),
//       }))
//     },
//     (res) => {
//       throw new Error(
//         `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
//       )
//     },
//   )
// }

// const globalCache = new HttpRangeFetcher({
//   fetch: fetchBinaryRange,
//   size: 100 * 1024 * 1024, // 100MB
//   chunkSize: 2 ** 18, // 256KB
//   aggregationTime: 50,
// })

// export default globalCache

// function globalCacheFetch(url, opts) {
//   // if (/2bit/.test(url)) debugger
//   if (opts && opts.headers && opts.headers.range) {
//     const rangeParse = /bytes=(\d+)-(\d+)/.exec(opts.headers.range)
//     if (rangeParse) {
//       const [, start, end] = rangeParse
//       return globalCache.getRange(url, start, end - start + 1, {
//         signal: opts.signal,
//       }).then((response) => {
//         let { headers } = response
//         if (!(headers instanceof Map)) {
//           headers = new Map(Object.entries(headers))
//         }
//         return {
//           status: 206,
//           ok: true,
//           async arrayBuffer() {
//             const b = response.buffer
//             debugger
//             const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
//             // if (ab.length !== b.length) debugger
//             return ab
//           },
//           ...response,
//           headers,
//         }
//       })
//     }
//   }

//   return getfetch(url, opts)
// }

// eslint-disable-next-line import/prefer-default-export
export function openUrl(url) {
  return new RemoteFile(String(url), {
    fetch: getfetch,
  })
}
