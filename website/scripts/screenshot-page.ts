// Per-page setup and diagnosis: what is installed before the app's first script
// runs, what the run remembers about the network so a timeout can name the fetch
// it was waiting on, and the rasterization barrier every capture ends with.
import type { Page } from 'puppeteer'

// What a spec's page asked the network for, so a timeout can say which fetch
// it was waiting on.
//
// A `readySelector` that never appears is the same error message whether the
// app crashed, the selector is wrong, or a remote file the view needs is
// unreachable — and the last of those is the common one, because most specs
// read 2bit/chrom.sizes/PIF straight off hgdownload or jbrowse.org. The console
// listener does print `net::ERR_TIMED_OUT` when it happens, but interleaved
// across four concurrent specs and hundreds of lines above a FAILURE SUMMARY
// that repeats only "Waiting for selector failed". That is how a spec whose
// real problem was one flaky UCSC fetch got diagnosed as a config bug and
// "fixed" by an unrelated rename.
//
// So: hold the failed and the still-outstanding requests, and let the failure
// path name them.
export function trackNetwork(page: Page) {
  const failed = new Map<string, { errorText: string; count: number }>()
  const inflight = new Map<object, { url: string; start: number }>()
  page.on('request', r => {
    inflight.set(r, { url: r.url(), start: Date.now() })
  })
  const settle = (r: object) => inflight.delete(r)
  page.on('requestfinished', settle)
  page.on('requestfailed', r => {
    settle(r)
    // a navigation supersedes its pending requests and aborts them; that is
    // routine and says nothing about reachability
    const errorText = r.failure()?.errorText ?? 'unknown'
    if (errorText !== 'net::ERR_ABORTED') {
      const prev = failed.get(r.url())
      failed.set(r.url(), { errorText, count: (prev?.count ?? 0) + 1 })
    }
  })
  return { failed, inflight }
}

// Requests are keyed by URL for the report because the interesting case is one
// file retried: `generic-filehandle` refetches once to work around a Chrome CORS
// caching bug, so a host that is genuinely down shows up as the same URL twice
// rather than as two separate lines.
export function describeNetwork(
  { failed, inflight }: ReturnType<typeof trackNetwork>,
  now = Date.now(),
) {
  const short = (url: string) =>
    url.length > 100 ? `${url.slice(0, 97)}...` : url
  const lines = [
    ...[...failed].map(
      ([url, { errorText, count }]) =>
        `    ${errorText}${count > 1 ? ` (x${count})` : ''} ${short(url)}`,
    ),
    // Anything still outstanding when the wait gave up. Sub-second requests are
    // just whatever was in flight at that instant, so only report the ones that
    // have been open long enough to be the reason.
    ...[...inflight.values()]
      .filter(({ start }) => now - start > 5000)
      .sort((a, b) => a.start - b.start)
      .map(
        ({ url, start }) =>
          `    still pending after ${Math.round((now - start) / 1000)}s ${short(url)}`,
      ),
  ]
  return lines.length
    ? `\n  network:\n${lines.slice(0, 8).join('\n')}${
        lines.length > 8 ? `\n    ...and ${lines.length - 8} more` : ''
      }`
    : ''
}

// Kill CSS transitions and animations for the whole capture session, installed
// before any app script runs so it covers the action chain too, not just the
// final frame. Menus, ripples and MUI Grow/Fade fly-outs then jump straight to
// their settled geometry: they can't be caught mid-transition (the dominant
// source of run-to-run diffs on menu specs) and a click that follows a
// `waitForText` can't land on a popper that is still sliding into place — which
// is what the fixed `delay`s after those waits were really paying for.
export function freezeAnimations(page: Page) {
  return page.evaluateOnNewDocument(() => {
    const install = () => {
      const style = document.createElement('style')
      style.textContent =
        '*,*::before,*::after{transition:none !important;animation:none !important;}'
      document.head.append(style)
    }
    // lib.dom types document.head as non-null, but this runs via
    // evaluateOnNewDocument — before the parser has built <head> — so the
    // runtime check is real
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (document.head) {
      install()
    } else {
      document.addEventListener('DOMContentLoaded', install)
    }
  })
}

// Plugin urls a hosted demo config may declare, pre-approved for the capture so
// the cross-origin warning modal never covers the app. Scoped to the capture's
// own localhost origin (see below) and vouching for nothing beyond it. Keep it an
// explicit list rather than "trust everything", so a config that starts pulling
// an unexpected plugin still fails loudly.
//
// Beside its one consumer rather than in screenshot-options.ts, which parses
// process.argv on import: generate-video.ts trusts the same plugins and takes
// different flags.
const TRUSTED_PLUGIN_URLS = [
  'https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js',
  // demos/alphagenome/config.json, pinned to a content-addressed build — see
  // that demo's README for why the pin is there and what bumping it means here
  'https://jbrowse.org/demos/alphagenome-plugin/c70db17cdfe4/jbrowse-plugin-alphagenome.umd.js',
]

// Pre-approve the cross-origin plugin warning, which otherwise covers the whole
// app with a modal and fails every spec whose `?config=` points at a hosted
// config declaring an `esmUrl` plugin. jbrowse.org/demos/ecoli_pangenome is one:
// it declares GraphGenomeView so a reader who opens the demo gets the graph
// tracks, and that is worth keeping rather than stripping the plugin to suit the
// generator.
//
// This grants nothing a person could not: the store is localStorage under the
// capture's own localhost origin, which the browser partitions, so it cannot
// vouch for a plugin on jbrowse.org or anywhere else. Written before any app
// script runs, since SessionLoader reads it during startup.
export function trustCapturePlugins(page: Page) {
  return page.evaluateOnNewDocument((urls: string[]) => {
    try {
      const KEY = 'jbrowse-trusted-plugins'
      const raw = localStorage.getItem(KEY)
      const trusted = new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
      for (const url of urls) {
        trusted.add(url)
      }
      localStorage.setItem(KEY, JSON.stringify([...trusted]))
    } catch (e) {
      console.error(e)
    }
  }, TRUSTED_PLUGIN_URLS)
}

// Wait for the browser to actually rasterize the current DOM before capturing.
// A single rAF callback fires *before* paint, so a freshly-composited layer —
// e.g. a just-opened menu Popper, on its own GPU layer that software-GL
// (swiftshader) rasterizes a frame late at deviceScaleFactor 2 — can be fully
// settled in the DOM (opacity:1, laid out) yet still absent from the capture,
// the dominant cause of menu-spec flakiness. Two chained rAFs guarantee a full
// frame committed; the trailing settle gives slow layer rasterization a beat.
export async function waitForRasterize(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 50)
          })
        })
      }),
  )
}
