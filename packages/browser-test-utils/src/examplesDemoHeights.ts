import http from 'node:http'

import { BASE_CHROME_ARGS, findChromeExecutable } from '@jbrowse/capture'
import puppeteer from 'puppeteer'
import handler from 'serve-handler'

import { DESKTOP_VIEWPORT } from './examplesSmoke.ts'

// Measure the height every demo on an examples-site settles at, so those figures
// can be generated rather than typed.
//
// They are needed because every demo is a `client:only` island: Astro gives the
// island `display: contents`, so until React hydrates, the demo's box is empty
// and 0 high with several hundred KB of engine still to fetch. Reserving the
// settled height on that box is what stops the page dropping everything below it
// when the demo finally arrives. `pnpm smoke` re-checks the reservation each run,
// so what this exists for is producing them in the first place — and re-producing
// all of them after a change that moves a track's height.
//
// Two widths, and the larger figure wins. The rule is **reserve the tallest**: a
// reservation that is too small jumps the page, which is the whole failure being
// prevented, while one that is too large only leaves space inside the demo's own
// border. A demo whose own controls wrap is taller in a narrow window, and the
// narrowest a content column ever gets is just *above* the sidebar breakpoint —
// below it the sidebar collapses and the column gets wider again, so the narrow
// probe sits deliberately at 840px rather than lower.
const NARROW_VIEWPORT = { width: 840, height: 900 }

export interface DemoHeightOptions {
  // absolute path to the built Astro `dist/` directory
  distDir: string
  // the site's Astro `base`, e.g. '/storybook/byo'
  base: string
  // example slugs to load; each page's demos are keyed by their section id
  slugs: string[]
  // ms to settle after networkidle before measuring (lets islands mount/draw)
  settleMs?: number
  // progress sink; defaults to a no-op so the library stays console-free
  log?: (message: string) => void
}

// Every demo box on the page, keyed by the id of the section it belongs to, with
// its own reservation neutralised so this measures the content rather than the
// number already committed. A `.demo` outside a section is skipped: that is a
// landing page running one of the examples a second time, which takes its
// reservation from that example's own entry rather than earning one of its own.
// A function rather than a source string so its return type is checked here and
// carries into `page.evaluate`; puppeteer serializes it either way. It must stay
// closure-free — nothing in this module exists in the page.
const MEASURE = () => {
  const out: Record<string, number> = {}
  for (const el of document.querySelectorAll('.demo')) {
    const slug = el.closest('section.example-section')?.id
    if (!slug || !(el instanceof HTMLElement)) {
      continue
    }
    const before = el.style.minHeight
    el.style.minHeight = '0px'
    out[slug] = Math.round(el.getBoundingClientRect().height)
    el.style.minHeight = before
  }
  return out
}

export async function measureDemoHeights({
  distDir,
  base,
  slugs,
  settleMs = 6000,
  log = () => {},
}: DemoHeightOptions): Promise<Record<string, number>> {
  const server = http.createServer((req, res) => {
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

  const tallest: Record<string, number> = {}
  for (const viewport of [DESKTOP_VIEWPORT, NARROW_VIEWPORT]) {
    for (const slug of slugs) {
      const page = await browser.newPage()
      await page.setViewport(viewport)
      try {
        await page.goto(`http://localhost:${port}${base}/${slug}/`, {
          waitUntil: 'networkidle0',
          timeout: 45000,
        })
      } catch {
        // a background fetch that never quiesced; the settle below still gives
        // the island time to mount, and a demo that genuinely failed to render
        // shows up as an implausible height rather than being silently believed
      }
      await new Promise(r => setTimeout(r, settleMs))
      const measured = await page.evaluate(MEASURE)
      for (const [key, height] of Object.entries(measured)) {
        tallest[key] = Math.max(tallest[key] ?? 0, height)
      }
      log(
        `  ${viewport.width}px  ${slug.padEnd(26)} ${Object.entries(measured)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')}`,
      )
      await page.close()
    }
  }

  await browser.close()
  await new Promise<void>(resolve => {
    server.close(() => {
      resolve()
    })
  })
  return Object.fromEntries(
    Object.entries(tallest).sort(([a], [b]) => a.localeCompare(b)),
  )
}
