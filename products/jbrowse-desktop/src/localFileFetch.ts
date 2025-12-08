import { open, readFile, stat } from 'fs/promises'

// Custom fetch for file:// URLs using Node's fs module
export async function localFileFetch(
  url: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const urlStr = typeof url === 'string' ? url : url.url

  if (!urlStr.startsWith('file://')) {
    return fetch(url, init)
  }

  const filePath = decodeURIComponent(
    urlStr.startsWith('file:///') ? urlStr.slice(7) : urlStr.slice(5),
  )

  const rangeHeader = init?.headers
    ? new Headers(init.headers).get('range')
    : null

  if (rangeHeader) {
    const match = /bytes=(\d+)-(\d+)?/.exec(rangeHeader)
    if (match) {
      const start = Number.parseInt(match[1]!, 10)
      const end = match[2] ? Number.parseInt(match[2], 10) : undefined
      const stats = await stat(filePath)
      const actualEnd = end ?? stats.size - 1
      const length = actualEnd - start + 1

      const fileHandle = await open(filePath, 'r')
      const buffer = new Uint8Array(length)
      await fileHandle.read(buffer, 0, length, start)
      await fileHandle.close()

      return new Response(buffer, {
        status: 206,
        headers: {
          'content-range': `bytes ${start}-${actualEnd}/${stats.size}`,
          'content-length': String(length),
        },
      })
    }
  }

  const data = await readFile(filePath)
  return new Response(data, {
    status: 200,
    headers: {
      'content-length': String(data.length),
    },
  })
}
