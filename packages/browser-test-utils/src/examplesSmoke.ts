import http from 'http'

import puppeteer from 'puppeteer'
import handler from 'serve-handler'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from './browser.ts'

// This guard targets bundle/eval integrity (the Rollup circular-dependency TDZ),
// not the availability of the third-party hosts the examples fetch data/plugins
// from (jbrowse.org, unpkg, S3). A DNS/connection failure to one of those is an
// environment problem, not a code regression, so it must not redden CI — the
// demo-mounted and worker-spawn assertions still verify the bundle actually ran.
// Uncaught exceptions (pageerror) are always treated as real, never filtered.
function isNetworkNoise(text: string): boolean {
  return (
    text.includes('net::ERR_') ||
    text.includes('Failed to load resource') ||
    text.includes('Failed to fetch') ||
    text.includes('Fetch failed')
  )
}

export interface SmokeOptions {
  // absolute path to the built Astro `dist/` directory
  distDir: string
  // the site's Astro `base`, e.g. '/storybook/lgv'
  base: string
  // every example slug to load (one page per slug)
  slugs: string[]
  // a slug that must spawn an RPC web worker (the circular-dependency TDZ guard);
  // its page fails if no worker is created. omit if the site has no worker example
  workerSlug?: string
  // ms to settle after networkidle before asserting (lets islands mount/draw)
  settleMs?: number
  // progress sink (e.g. console.log from a CLI wrapper); defaults to a no-op so
  // the library stays console-free
  log?: (message: string) => void
}

// Serve a built examples-site `dist/`, load every page in headless Chrome, and
// fail on any non-noise console/page error or an empty demo. When `workerSlug`
// is set, that page additionally asserts an RPC worker actually spawns — the
// guard for the Rollup circular-dependency TDZ ("Cannot access X before
// initialization") that webpack tolerates but Vite/Rollup does not.
//
// Returns the number of failed pages (0 = all passed). Shared by every
// product's examples-site smoke script so they can't drift.
export async function smokeExamplesSite({
  distDir,
  base,
  slugs,
  workerSlug,
  settleMs = 4000,
  log = () => {},
}: SmokeOptions): Promise<number> {
  const server = http.createServer((req, res) => {
    // strip the Astro base prefix so /storybook/<x>/foo/ resolves to dist/foo/
    if (req.url?.startsWith(base)) {
      req.url = req.url.slice(base.length) || '/'
    }
    void handler(req, res, { public: distDir })
  })
  await new Promise<void>(resolve => {
    server.listen(0, resolve)
  })
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0

  const browser = await puppeteer.launch({
    executablePath: findChromeExecutable(),
    args: [
      ...BASE_CHROME_ARGS,
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  })

  let failures = 0
  for (const slug of slugs) {
    const page = await browser.newPage()
    const errors: string[] = []
    const workers: string[] = []
    page.on('workercreated', w => {
      workers.push(w.url())
    })
    page.on('console', m => {
      const text = m.text()
      if (
        m.type() === 'error' &&
        !isBrowserConsoleNoise(text) &&
        !isNetworkNoise(text)
      ) {
        errors.push(`console: ${text}`)
      }
    })
    page.on('pageerror', e => {
      errors.push(`pageerror: ${e instanceof Error ? e.message : String(e)}`)
    })
    try {
      await page.goto(`http://localhost:${port}${base}/${slug}/`, {
        waitUntil: 'networkidle0',
        timeout: 45000,
      })
    } catch (e) {
      // A networkidle timeout means some background fetch (a remote track/data
      // host) never quiesced — not a code regression. Proceed anyway: the
      // pageerror/console listeners and the demo-mounted + worker-spawn checks
      // below are the real health signals and don't depend on network idle.
      log(`     (note) ${slug}: ${e instanceof Error ? e.message : String(e)}`)
    }
    await new Promise(r => setTimeout(r, settleMs))
    const demoLen = await page
      .$eval('.demo', el => el.innerHTML.length)
      .catch(() => 0)
    if (demoLen < 50) {
      errors.push(`empty demo (innerHTML len ${demoLen})`)
    }
    if (slug === workerSlug && !workers.some(u => u.includes('rpcWorker'))) {
      errors.push(`no rpc worker spawned (workers: ${JSON.stringify(workers)})`)
    }
    if (errors.length) {
      failures++
      log(`FAIL ${slug}`)
      for (const e of errors) {
        log(`     ${e}`)
      }
    } else {
      log(`ok   ${slug}`)
    }
    await page.close()
  }

  await browser.close()
  await new Promise<void>(resolve => {
    server.close(() => {
      resolve()
    })
  })
  log(`\n${slugs.length - failures}/${slugs.length} pages OK`)
  return failures
}
