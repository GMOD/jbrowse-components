/* eslint-disable no-console */
// One-off probe (not a suite): does a highlight band reveal its chip when the
// real pointer moves over it, including over a track's own canvas — which jsdom
// cannot answer, since the reveal rides on a mousemove bubbling out of whatever
// the pointer is actually over.
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

try {
  const page = await browser.newPage()
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
  await shoot(page, '1-at-rest')

  // over the band but low down, where a track's canvas is what the pointer is
  // really on
  await page.mouse.move(band.left + band.width / 2, band.top + band.height - 40)
  await delay(300)
  console.log('chips hovering the band over a track:', await chipCount(page))
  await shoot(page, '2-hovered')

  await page.mouse.move(band.left + band.width + 300, band.top + 100)
  await delay(300)
  console.log('chips after moving off:', await chipCount(page))
  await shoot(page, '3-moved-off')

  // back on, then open the menu and walk the pointer away from the band
  await page.mouse.move(band.left + band.width / 2, band.top + band.height - 40)
  await delay(300)
  await page.click('[data-testid="highlight-chip"]')
  await delay(500)
  await shoot(page, '4-menu-open')
  await page.mouse.move(band.left + band.width + 300, band.top + 400)
  await delay(400)
  console.log('chips with the menu open, pointer away:', await chipCount(page))
  const menuItems = await page.$$eval('[role="menuitem"]', els =>
    els.map(el => el.textContent),
  )
  console.log('menu items still up:', menuItems)
  await shoot(page, '5-menu-open-pointer-away')
} finally {
  await browser.close()
  server.close()
}
