const jestFetchMock = require('jest-fetch-mock')

function handleDataUri(urlStr) {
  if (urlStr.startsWith('data:')) {
    const match = urlStr.match(/^data:([^;,]*)(;base64)?,(.*)$/)
    if (match) {
      const [, mimeType, isBase64, data] = match
      const bytes = isBase64
        ? Uint8Array.from(atob(data), c => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(data))
      return new Response(bytes, {
        headers: { 'Content-Type': mimeType || 'text/plain' },
      })
    }
  }
  return null
}

global.fetch = async (url, options) => {
  const urlStr = typeof url === 'string' ? url : url.toString()
  const dataUriResponse = handleDataUri(urlStr)
  if (dataUriResponse) {
    return dataUriResponse
  }
  return jestFetchMock(url, options)
}

Object.assign(global.fetch, jestFetchMock)
