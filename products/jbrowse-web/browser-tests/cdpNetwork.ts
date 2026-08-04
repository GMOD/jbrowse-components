import type { Page } from 'puppeteer'

export interface WireRequest {
  // absolute request url, or '' if the response event was never seen
  url: string
  // bytes actually transferred (CDP encodedDataLength), which is what a bundle
  // budget is about — not the decoded size and not the on-disk size
  bytes: number
}

// A request's transfer size arrives on `Network.loadingFinished`, which carries
// only a requestId; its url arrived earlier on `Network.responseReceived`. Every
// bytes-over-the-wire script here needs the two joined, and each used to do it
// with its own Map and its own `(e: any)` handlers — the CDP events are fully
// typed by puppeteer, so those casts were only turning checking off.
//
// The returned array fills in as the page loads: read it after the navigation
// (and whatever settle the caller wants) has finished.
export async function collectWireRequests(page: Page) {
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  const urlByRequestId = new Map<string, string>()
  const requests: WireRequest[] = []
  client.on('Network.responseReceived', e => {
    urlByRequestId.set(e.requestId, e.response.url)
  })
  client.on('Network.loadingFinished', e => {
    requests.push({
      url: urlByRequestId.get(e.requestId) ?? '',
      bytes: e.encodedDataLength,
    })
  })
  return requests
}

// A script chunk, by url. Anchored on the extension so a `.json` config or a
// `.js.map` sourcemap isn't counted as JS — `url.includes('.js')` matches both.
export function isJsUrl(url: string) {
  return /\.js([?#]|$)/.test(url)
}

export function isJsOrCssUrl(url: string) {
  return /\.(js|css)([?#]|$)/.test(url)
}

// The headline numbers every load measurement reports: JS bytes/requests, and
// the total across all asset types.
export function summarizeWire(requests: WireRequest[]) {
  const js = requests.filter(r => isJsUrl(r.url))
  return {
    jsBytes: js.reduce((sum, r) => sum + r.bytes, 0),
    jsCount: js.length,
    allBytes: requests.reduce((sum, r) => sum + r.bytes, 0),
  }
}

// Basename of a url, with any query string dropped.
export function urlBasename(url: string) {
  return url.split('/').pop()!.split('?')[0]!
}
