import 'whatwg-fetch'
import tenaciousFetch from 'tenacious-fetch'
import uri2path from 'file-uri-to-path'

import { HttpRangeFetcher } from 'http-range-fetcher'
import { Buffer } from 'buffer'

import LocalFile from './localFile'

function isElectron() {
  return false // TODO
}

function unReplacePath() {
  throw new Error('unimplemented') // TODO
}

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

function fetchBinaryRange(url, start, end) {
  const requestDate = new Date()
  const requestHeaders = {
    headers: { range: `bytes=${start}-${end}` },
    onRetry: ({ retriesLeft /* , retryDelay */ }) => {
      console.warn(
        `${url} bytes ${start}-${end} request failed, retrying (${retriesLeft} retries left)`,
      )
    },
  }
  return getfetch(url, requestHeaders).then(
    (res) => {
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
          console.warn('Could not get size of file', url, e)
        }
      } else if (res.status === 200) {
        throw new Error(
          `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
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
    (res) => {
      throw new Error(
        `HTTP ${res.status} when fetching ${url} bytes ${start}-${end}`,
      )
    },
  )
}

const globalCache = new HttpRangeFetcher({
  fetch: fetchBinaryRange,
  size: 100 * 1024 * 1024, // 100MB
  chunkSize: 2 ** 18, // 256KB
  aggregationTime: 50,
})

export default globalCache

class GloballyCachedFilehandle {
  constructor(url) {
    this.url = url

    // if it is a file URL, monkey-patch ourselves to act like a LocalFile
    if (String(url).startsWith('file://')) {
      const path = uri2path(url)
      if (!path) throw new TypeError('invalid file url')
      const localFile = new LocalFile(path)
      this.read = localFile.read.bind(localFile)
      this.readFile = localFile.readFile.bind(localFile)
      this.stat = localFile.stat.bind(localFile)
      this.fetch = () => {}
    }
  }

  async read(buffer, offset = 0, length, position, abortSignal) {
    let data
    if (length === undefined && offset === 0) {
      data = await this.readFile()
    } else {
      data = (await globalCache.getRange(this.url, position, length, {
        signal: abortSignal,
      })).buffer
    }
    data.copy(buffer, offset)
    return data.length
  }

  async readFile(abortSignal) {
    const res = await getfetch(this.url, { signal: abortSignal })
    return Buffer.from(await res.arrayBuffer())
  }

  stat(abortSignal) {
    return globalCache.stat(this.url, { signal: abortSignal })
  }

  toString() {
    return this.url
  }
}

export function openUrl(url) {
  return new GloballyCachedFilehandle(url)
}
