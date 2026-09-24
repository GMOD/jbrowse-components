/* eslint-disable no-console */
// Does a worker's own prefetch make its later importScripts a cache read, in
// Chrome and Firefox? Counted at a second origin that sends what jbrowse.org
// sends for a versioned plugin: immutable, CORS *, Vary: Origin.
import http from 'node:http'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

const variants: Record<string, { page: string; worker: string }> = {
  'page cors script, then worker importScripts': {
    page: `const s=document.createElement('script');s.crossOrigin='anonymous';s.src=U;document.head.append(s);await new Promise(r=>s.onload=r)`,
    worker: `importScripts(U)`,
  },
  'worker no-cors fetch, then importScripts': {
    page: ``,
    worker: `await (await fetch(U,{mode:'no-cors'})).arrayBuffer();importScripts(U)`,
  },
  'worker no-cors+include fetch, then importScripts': {
    page: ``,
    worker: `await (await fetch(U,{mode:'no-cors',credentials:'include'})).arrayBuffer();importScripts(U)`,
  },
  'worker cors fetch, then importScripts': {
    page: ``,
    worker: `await (await fetch(U)).arrayBuffer();importScripts(U)`,
  },
  'page cors script, then worker cors fetch': {
    page: `const s=document.createElement('script');s.crossOrigin='anonymous';s.src=U;document.head.append(s);await new Promise(r=>s.onload=r)`,
    worker: `await (await fetch(U)).arrayBuffer()`,
  },
}

async function main() {
  const hits = new Map<string, number>()
  const plugin = http
    .createServer((req, res) => {
      const key = req.url!
      hits.set(key, (hits.get(key) ?? 0) + 1)
      const headers: Record<string, string> = {
        'content-type': 'text/javascript',
        'cache-control': 'public, max-age=31536000, immutable',
      }
      if (req.headers.origin) {
        headers['access-control-allow-origin'] = '*'
        headers.vary = 'Origin'
      }
      res.writeHead(200, headers)
      res.end('self.pluginRan = (self.pluginRan || 0) + 1')
    })
    .listen(4001)
  const app = http
    .createServer((req, res) => {
      const [, name, id] = /\?v=([^&]*)&id=(\d+)/.exec(req.url!) ?? []
      const v = name ? variants[decodeURIComponent(name)] : undefined
      const U = JSON.stringify(`http://localhost:4001/p.js?id=${id}`)
      if (!v) {
        res.writeHead(404)
        res.end()
      } else if (req.url!.startsWith('/worker.js')) {
        res.writeHead(200, { 'content-type': 'text/javascript' })
        res.end(
          `const U=${U};(async()=>{${v.worker};postMessage('done')})().catch(e=>postMessage('err '+e))`,
        )
      } else {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end(
          `<script type=module>const U=${U};${v.page};const w=new Worker('/worker.js?v=${name}&id=${id}');w.onmessage=e=>{document.title=e.data}</script>`,
        )
      }
    })
    .listen(4000)
  let id = 0
  for (const browserName of ['chrome', 'firefox'] as const) {
    for (const name of Object.keys(variants)) {
      id++
      const browser = await launch(
        browserName === 'chrome'
          ? { headless: true, args: BASE_CHROME_ARGS }
          : {
              browser: 'firefox',
              executablePath: '/usr/bin/firefox-nightly',
              headless: true,
            },
      )
      const page = await browser.newPage()
      await page.goto(
        `http://localhost:4000/?v=${encodeURIComponent(name)}&id=${id}`,
      )
      await page.waitForFunction(() => document.title.length > 0, {
        timeout: 20000,
      })
      console.log(
        `${browserName} | ${name}: ${await page.title()}, ${hits.get(`/p.js?id=${id}`)} request(s) reached the server`,
      )
      await browser.close()
    }
  }
  plugin.close()
  app.close()
}

void main()
