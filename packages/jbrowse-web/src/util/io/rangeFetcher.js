import 'whatwg-fetch'
import tenaciousFetch from 'tenacious-fetch'

import { HttpRangeFetcher } from 'http-range-fetcher'
import { Buffer } from 'buffer'

function isElectron() {
  return false // TODO
}

function unReplacePath() {
  throw new Error('unimplemented') // TODO
}

function fetchBinaryRange(url, start, end) {
  const requestDate = new Date()
  let mfetch
  if (isElectron()) {
    if (url.slice(0, 4) === 'http') {
      mfetch = window.electronRequire('node-fetch')
    } else {
      mfetch = fetch
    }
  } else {
    mfetch = tenaciousFetch
  }
  return mfetch(url, {
    method: 'GET',
    headers: { range: `bytes=${start}-${end}` },
    credentials: 'same-origin',
    retries: 5,
    retryDelay: 1000, // 1 sec, 2 sec, 3 sec
    retryStatus: [500, 404, 503],
    onRetry: ({ retriesLeft, retryDelay }) => {
      console.warn(
        `${url} bytes ${start}-${end} request failed, retrying (${retriesLeft} retries left)`,
      )
    },
  }).then(
    res => {
      const responseDate = new Date()
      if (res.status !== 206 && res.status !== 200)
        throw new Error(
          `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
        )

      // translate the Headers object into a regular key -> value object.
      // will miss duplicate headers of course
      const headers = {}
      for (const [k, v] of res.headers.entries()) {
        headers[k] = v
      }

      if (isElectron()) {
        // electron charmingly returns HTTP 200 for byte range requests,
        // and does not fill in content-range. so we will fill it in
        try {
          if (!headers['content-range']) {
            const fs = window.electronRequire('fs') // Load the filesystem module
            const stats = fs.statSync(unReplacePath(url))
            headers['content-range'] = `${start}-${end}/${stats.size}`
          }
        } catch (e) {
          console.error('Could not get size of file', url, e)
        }
      } else if (res.status === 200) {
        throw new Error(
          `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
        )
      }

      // if we now still have no content-range header, the most common reason
      // is because the remote server doesn't support CORS
      if (!headers['content-range']) {
        throw new Error(
          `could not read Content-Range for ${url}, the remote server may not support JBrowse (need CORS and HTTP Range requests)`,
        )
      }

      // return the response headers, and the data buffer
      return res.arrayBuffer().then(arrayBuffer => ({
        headers,
        requestDate,
        responseDate,
        buffer: Buffer.from(arrayBuffer),
      }))
    },
    res => {
      throw new Error(
        `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
      )
    },
  )
}

const globalCache = new HttpRangeFetcher({
  fetch: fetchBinaryRange,
  size: 50 * 1024, // 50MB
  chunkSize: 2 ** 18, // 256KB
  aggregationTime: 50,
})

export default globalCache

class GloballyCachedFilehandle {
  constructor(url) {
    this.url = url
  }

  async read(buffer, offset = 0, length, position) {
    const { buffer: data } = await globalCache.getRange(
      this.url,
      position,
      length,
    )
    data.copy(buffer, offset)
    return data.length
  }

  async readFile() {
    const range = await globalCache.getRange(this.url, 0)
    return range.buffer
  }

  stat() {
    return globalCache.stat(this.url)
  }

  toString() {
    return this.url
  }
}

export function openUrl(url) {
  return new GloballyCachedFilehandle(url)
}
