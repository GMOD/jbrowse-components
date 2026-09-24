import type { CDPSession, Page } from 'puppeteer'

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

export interface TimedRequest {
  url: string
  // ms after the page's first request
  start: number
  end?: number
  inWorker: boolean
}

// Every request the page and its web workers make, with `latencyMs` added to
// each. A worker's requests are only visible on its own target, so each worker
// is attached to as it starts; its first fetch comes after its entry script
// has crossed the emulated latency, which is time enough to switch the network
// domain on.
export async function collectTimedRequests(page: Page, latencyMs: number) {
  const client = await page.createCDPSession()
  const requests = new Map<string, TimedRequest>()
  const conditions = {
    offline: false,
    latency: latencyMs,
    downloadThroughput: -1,
    uploadThroughput: -1,
  }
  let t0: number | undefined
  function track(session: CDPSession, scope: string) {
    session.on('Network.requestWillBeSent', e => {
      t0 ??= e.timestamp
      requests.set(`${scope}:${e.requestId}`, {
        url: e.request.url,
        start: (e.timestamp - t0) * 1000,
        inWorker: scope !== 'page',
      })
    })
    const finish = (e: { requestId: string; timestamp: number }) => {
      const r = requests.get(`${scope}:${e.requestId}`)
      if (r && t0 !== undefined) {
        r.end = (e.timestamp - t0) * 1000
      }
    }
    session.on('Network.loadingFinished', finish)
    session.on('Network.loadingFailed', finish)
  }
  track(client, 'page')
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', conditions)
  client.on('Target.attachedToTarget', e => {
    const session = client.connection()?.session(e.sessionId)
    if (session && e.targetInfo.type === 'worker') {
      track(session, e.sessionId)
      void session
        .send('Network.enable')
        .then(() =>
          session.send('Network.emulateNetworkConditions', conditions),
        )
        .catch(() => {})
    }
  })
  await client.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  })
  return () => [...requests.values()].sort((a, b) => a.start - b.start)
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
