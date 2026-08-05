import http from 'node:http'

import puppeteer from 'puppeteer'
import handler from 'serve-handler'

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  isBrowserConsoleNoise,
} from './browser.ts'

import type { Page } from 'puppeteer'

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
    text.includes('Fetch failed') ||
    // HTTP 5xx from a remote data host (fetchJson.ts, RemoteFileWithRangeCache.ts
    // throw "HTTP <status> fetching <url>") is a transient host outage, not a
    // code regression
    /HTTP 5\d\d fetching/.test(text)
  )
}

// An ordinary laptop, and the point is that it is wider than the 820px at which
// these sites collapse their sidebar: the content column a reader actually gets.
export const DESKTOP_VIEWPORT = { width: 1440, height: 900 }

// Deadline for the island to hydrate. A liveness bound, not a perf budget —
// generous on purpose, because the cost of it being too tight is a red CI run
// on healthy code, while the cost of it being loose is only that a genuinely
// dead page takes this long to say so.
const MOUNT_TIMEOUT_MS = 15000

export interface SmokeOptions {
  // absolute path to the built Astro `dist/` directory
  distDir: string
  // the site's Astro `base`, e.g. '/storybook/lgv'
  base: string
  // every example slug to load (one page per slug). The empty string is the
  // site's landing page, which is worth including wherever it runs a demo of
  // its own rather than only linking to them
  slugs: string[]
  // a slug that must spawn an RPC web worker (the circular-dependency TDZ guard);
  // its page fails if no worker is created. omit if the site has no worker example
  workerSlug?: string
  // ms to settle after networkidle before asserting (lets islands mount/draw)
  settleMs?: number
  // the window every page is loaded in. Set explicitly because puppeteer's own
  // default is 800x600, which is *under* these sites' 820px sidebar breakpoint —
  // so left alone, every check any of them has ever run has run against the
  // collapsed-sidebar layout, in a content column no reader on a desktop sees.
  viewport?: { width: number; height: number }
  // extra per-page assertions, run once the page has settled. Return one
  // message per failure (empty array = passed); they are reported like any
  // other error on that page. For anything a load-only check can't see — a
  // control that renders but doesn't respond to a real click, say
  check?: (page: Page, slug: string) => Promise<string[]>
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
  viewport = DESKTOP_VIEWPORT,
  check,
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
    // '' is the landing page: `${base}/${slug}/` would give it a double slash
    const url = `http://localhost:${port}${base}/${slug ? `${slug}/` : ''}`
    const name = slug || 'index'
    const page = await browser.newPage()
    await page.setViewport(viewport)
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
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 45000,
      })
    } catch (e) {
      // A networkidle timeout means some background fetch (a remote track/data
      // host) never quiesced — not a code regression. Proceed anyway: the
      // pageerror/console listeners and the demo-mounted + worker-spawn checks
      // below are the real health signals and don't depend on network idle.
      log(`     (note) ${name}: ${e instanceof Error ? e.message : String(e)}`)
    }
    // Wait for the island to mount, rather than trusting a fixed delay to have
    // covered it. `.demo` is empty until React hydrates, and when several of
    // these suites (or a stray puppeteer probe) share a machine, hydration can
    // land after the settle has already elapsed — which reports as "empty demo"
    // on a page that is perfectly healthy. Waiting on the condition costs
    // nothing when it is already true and only stretches when the box is busy,
    // which is exactly when a fixed delay lies.
    //
    // The settle still runs afterwards: mounting is not drawing, and the
    // censuses below need the canvas painted, not just the island hydrated.
    const mounted = await page
      .waitForFunction(
        () => (document.querySelector('.demo')?.innerHTML.length ?? 0) >= 50,
        { timeout: MOUNT_TIMEOUT_MS },
      )
      .then(() => true)
      .catch(() => false)
    if (!mounted) {
      // Three outcomes the original check reported with one message, though
      // they have nothing to do with each other. Re-read rather than assume the
      // deadline means "empty": a page can fill in the moment between the
      // timeout and this line, and reporting that as "never mounted" while
      // printing a five-figure innerHTML length is worse than the message it
      // replaced. `$eval` rejects on a missing selector, so `undefined` is
      // absent and a number is present.
      const len = await page
        .$eval('.demo', el => el.innerHTML.length)
        .catch(() => undefined)
      errors.push(
        len === undefined
          ? 'no .demo element on the page — did this route build?'
          : len >= 50
            ? `demo mounted only after ${MOUNT_TIMEOUT_MS}ms — alive, but slow ` +
              'enough that every check below raced it'
            : `demo never mounted (innerHTML len ${len} after ${MOUNT_TIMEOUT_MS}ms)`,
      )
    }
    await new Promise(r => setTimeout(r, settleMs))
    if (slug === workerSlug && !workers.some(u => u.includes('rpcWorker'))) {
      errors.push(`no rpc worker spawned (workers: ${JSON.stringify(workers)})`)
    }
    if (check) {
      try {
        errors.push(...(await check(page, slug)))
      } catch (e) {
        errors.push(
          `check threw: ${e instanceof Error ? e.message : String(e)}`,
        )
      }
    }
    if (errors.length) {
      failures++
      log(`FAIL ${name}`)
      for (const e of errors) {
        log(`     ${e}`)
      }
    } else {
      log(`ok   ${name}`)
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
