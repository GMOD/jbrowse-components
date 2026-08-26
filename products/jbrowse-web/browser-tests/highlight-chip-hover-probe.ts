/* eslint-disable no-console */
// One-off probe (not a suite): does a highlight band reveal its chip when the
// real pointer moves over it, in both views that draw bands — over a track's own
// canvas in the LGV, and over the plot in the dotplot, where the pointer stream
// is also the drag machinery's. jsdom cannot answer either: the reveal rides on
// a move bubbling out of whatever the pointer is actually over.
//
//   node products/jbrowse-web/browser-tests/highlight-chip-hover-probe.ts [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  delay,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const outDir = process.argv[2] ?? '/tmp/highlight-chip-hover-probe'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
})

async function shoot(page: Page, name: string) {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) })
}

async function chipCount(page: Page) {
  return page.$$eval('[data-testid="highlight-chip"]', els => els.length)
}

async function moveTo(page: Page, x: number, y: number) {
  await page.mouse.move(x, y)
  await delay(300)
}

async function lgv(page: Page) {
  console.log('\n== LGV ==')
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        loc: 'ctgA:1..20000',
        assembly: 'volvox',
        tracks: ['volvox_sv_test'],
        highlight: [
          {
            refName: 'ctgA',
            start: 8000,
            end: 12000,
            assemblyName: 'volvox',
            label: 'a region',
          },
        ],
      },
    ],
  })
  await waitForDataLoaded(page, 90000)
  await page.waitForSelector('[data-testid="highlight-band"]')

  const band = await page.$eval('[data-testid="highlight-band"]', el => {
    const { left, top, width, height } = el.getBoundingClientRect()
    return { left, top, width, height }
  })
  console.log('band box', band)

  console.log('chips at rest:', await chipCount(page))
  await shoot(page, 'lgv-1-at-rest')

  // over the band but low down, where a track's canvas is what the pointer is
  // really on
  await moveTo(page, band.left + band.width / 2, band.top + band.height - 40)
  console.log('chips hovering the band over a track:', await chipCount(page))
  await shoot(page, 'lgv-2-hovered')

  await moveTo(page, band.left + band.width + 300, band.top + 100)
  console.log('chips after moving off:', await chipCount(page))
  await shoot(page, 'lgv-3-moved-off')

  // back on, then open the menu and walk the pointer away from the band
  await moveTo(page, band.left + band.width / 2, band.top + band.height - 40)
  await page.click('[data-testid="highlight-chip"]')
  await delay(500)
  await shoot(page, 'lgv-4-menu-open')
  await moveTo(page, band.left + band.width + 300, band.top + 400)
  console.log('chips with the menu open, pointer away:', await chipCount(page))
  console.log('menu items still up:', await menuItems(page))
  await shoot(page, 'lgv-5-menu-open-pointer-away')
}

// A point 100px clear of a band and still ON the plot: past the plot's edge is
// not a miss, it is no pointer at all, and would satisfy every "no chip" line
// below whatever the code did. Steps toward whichever side of the band has room.
function awayFrom(start: number, length: number, size: number) {
  return start > size / 2
    ? Math.max(0, start - 100)
    : Math.min(size - 1, start + length + 100)
}

async function menuItems(page: Page) {
  return page.$$eval('[role="menuitem"]', els => els.map(el => el.textContent))
}

async function dotplot(page: Page) {
  console.log('\n== dotplot ==')
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'DotplotView',
          tracks: ['grape_peach_synteny_mcscan'],
          views: [{ assembly: 'grape' }, { assembly: 'peach' }],
          // one band per axis: grape is the x axis here, peach the y
          highlight: [
            JSON.stringify({
              refName: 'chr1',
              start: 1_000_000,
              end: 4_000_000,
              assemblyName: 'grape',
            }),
            JSON.stringify({
              refName: 'Pp01',
              start: 1_000_000,
              end: 4_000_000,
              assemblyName: 'peach',
            }),
          ],
        },
      ],
    },
    'test_data/config_dotplot.json',
  )
  await waitForDataLoaded(page, 90000)
  await page.waitForSelector('[data-testid="dotplot_webgl_canvas"]')
  await delay(1000)

  // the plot's own coordinate space, off the model, plus where that space sits
  // on screen — the canvas shares the content div's grid cell and origin
  const plot = await page.evaluate(() => {
    const view = (window as any).JBrowseSession.views[0]
    const rect = document
      .querySelector('[data-testid="dotplot_webgl_canvas"]')!
      .getBoundingClientRect()
    return {
      origin: { left: rect.left, top: rect.top },
      size: { width: rect.width, height: rect.height },
      h: view.getHHighlightCoords(view.highlight[0]),
      v: view.getVHighlightCoords(view.highlight[1]),
    }
  })
  console.log('plot', plot)
  if (!plot.h || !plot.v) {
    throw new Error('a highlight landed on neither axis — check the refNames')
  }
  const hx = plot.origin.left + plot.h.left + plot.h.width / 2
  const vy = plot.origin.top + plot.v.top + plot.v.height / 2
  const offX =
    plot.origin.left + awayFrom(plot.h.left, plot.h.width, plot.size.width)
  const offY =
    plot.origin.top + awayFrom(plot.v.top, plot.v.height, plot.size.height)

  console.log('chips at rest:', await chipCount(page))
  await shoot(page, 'dotplot-1-at-rest')

  await moveTo(page, hx, offY)
  console.log(
    'chips in the x-axis band, clear of the y one:',
    await chipCount(page),
  )
  await shoot(page, 'dotplot-2-x-band')

  await moveTo(page, offX, vy)
  console.log(
    'chips in the y-axis band, clear of the x one:',
    await chipCount(page),
  )
  await shoot(page, 'dotplot-3-y-band')

  await moveTo(page, hx, vy)
  console.log('chips at their intersection:', await chipCount(page))
  await shoot(page, 'dotplot-4-both')

  await moveTo(page, offX, offY)
  console.log('chips clear of both:', await chipCount(page))

  // the plot takes pointer capture on pointerdown, which is what used to eat
  // the chip's click
  await moveTo(page, hx, offY)
  await page.click('[data-testid="highlight-chip"]')
  await delay(500)
  await shoot(page, 'dotplot-5-menu-open')
  await moveTo(page, offX, offY)
  console.log('chips with the menu open, pointer away:', await chipCount(page))
  console.log('menu items still up:', await menuItems(page))
}

try {
  const page = await browser.newPage()
  await lgv(page)
  await dotplot(page)
} finally {
  await browser.close()
  server.close()
}
