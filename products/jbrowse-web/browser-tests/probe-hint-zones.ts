/* eslint-disable no-console */
// Where in a view a wheel that did nothing raises the scroll-to-zoom prompt.
// The gate is "did anything actually scroll", so jsdom cannot answer it — a
// test there can dispatch a scroll event but not tell you whether the page
// produces one (see useScrollZoomHint.test's header).
//
// Three gestures per page load: over the view header, over the tracks area, and
// over the app below the view. `scrollY: 0` beside `hint: 0` is the case worth
// reading — the wheel moved nothing and said nothing.
//
// A raise quiets the prompt for 30s and longer each time (BaseSessionModel's
// `canShowScrollZoomHint`), which is longer than this probe wants to wait, so
// each zone lifts the pause by hand before the next one.
//
// Run against the built app; it starts its own server.
//
//     node products/jbrowse-web/browser-tests/probe-hint-zones.ts

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const CONFIG = 'test_data/grape_peach_synteny/config.json'

const specs = [
  [
    'LGV no tracks',
    {
      views: [
        { type: 'LinearGenomeView', assembly: 'peach', loc: 'Pp01:1..100000' },
      ],
    },
  ],
  [
    'LGV with track',
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'peach',
          loc: 'Pp01:1..100000',
          tracks: ['peach_genes'],
        },
      ],
    },
  ],
] as const

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
})

try {
  for (const [name, spec] of specs) {
    const page = await browser.newPage()
    await navigateWithSessionSpec(page, spec, CONFIG)
    // the zones are measured off laid-out boxes, so wait for the tracks rather
    // than sleeping at one — a track that has not arrived reads as no view
    await page.waitForSelector('[data-testid="tracksContainer"]', {
      timeout: 90000,
    })
    await waitForDataLoaded(page, 90000)
    await delay(1000)
    const zones = await page.evaluate(() => {
      const tracks = document.querySelector('[data-testid="tracksContainer"]')!
      const t = tracks.getBoundingClientRect()
      const v = tracks.parentElement!.parentElement!.getBoundingClientRect()
      return {
        header: { x: v.x + v.width / 2, y: v.y + 10 },
        tracks: { x: t.x + t.width / 2, y: t.y + t.height / 2 },
        below: { x: v.x + v.width / 2, y: Math.min(790, v.bottom + 60) },
        rects: { view: [v.y, v.height], tracks: [t.y, t.height] },
        scrollable:
          document.scrollingElement!.scrollHeight -
          document.scrollingElement!.clientHeight,
      }
    })
    console.log(name, 'zones', JSON.stringify(zones))

    for (const which of ['header', 'tracks', 'below'] as const) {
      const at = zones[which]
      await page.mouse.move(at.x, at.y)
      await delay(300)
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel({ deltaY: 250 })
        await delay(100)
      }
      await delay(900)
      const state = await page.evaluate(() => ({
        hint: [...document.querySelectorAll('[role="status"]')]
          .map(n => n.textContent)
          .filter(t => t.includes('scroll to zoom')).length,
        count: (window as any).JBrowseSession?.scrollZoomHintCount,
        scrollY: document.scrollingElement!.scrollTop,
      }))
      console.log(' ', name, which, JSON.stringify(at), JSON.stringify(state))
      // outlast the prompt's linger, so the next zone starts from nothing up
      await delay(6200)
      // ...and lift the pacing the raise just bought, which is the one thing
      // between zones that a page this probe drives cannot wait out
      await page.evaluate(() => {
        ;(window as any).JBrowseSession?.setScrollZoomHintPaused(false)
      })
    }
    await page.close()
  }
} finally {
  await browser.close()
  server.close()
}
