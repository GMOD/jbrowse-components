/* eslint-disable no-console */
// Throwaway: what the LinearSyntenyView header bar costs, piece by piece, at a
// range of window widths and row counts. The LGV twin is probe-lgv-header-fit.
//
//   node products/jbrowse-web/browser-tests/probe-synteny-header-fit.ts
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, navigateWithSessionSpec, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const devPort = process.env.DEV_PORT ? Number(process.env.DEV_PORT) : undefined
const started = devPort ? undefined : await startServerOnFreePort(3000)
const server = started?.server
setPort(devPort ?? started!.port)

const WIDTHS = [1400, 1100, 900, 800, 700, 600, 500]

const browser = await launch({
  headless: process.env.HEADLESS !== '0',
  args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
})

const read = (page: Page) =>
  page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>(
      '[data-testid="follow-synteny-toggle"]',
    )
    if (!anchor) {
      return null
    }
    const bar = anchor.parentElement!.parentElement!
    const label = (el: Element) => {
      const e = el as HTMLElement
      const btn = e.matches('button') ? e : e.querySelector('button')
      return (
        btn?.getAttribute('value') ||
        btn?.dataset.testid ||
        e.querySelector<HTMLElement>('[data-testid]')?.dataset.testid ||
        e.dataset.testid ||
        e.textContent.trim().slice(0, 18) ||
        `<${e.tagName.toLowerCase()}>`
      )
    }
    return {
      bar: { client: bar.clientWidth, scroll: bar.scrollWidth },
      children: [...bar.children].map(c => ({
        label: label(c),
        w: Math.round(c.getBoundingClientRect().width),
      })),
      searchBoxes: [
        ...document.querySelectorAll('[data-testid="autocomplete"]'),
      ].map(e => Math.round(e.getBoundingClientRect().width)),
    }
  })

try {
  for (const rows of [2, 3]) {
    const page = await browser.newPage()
    await navigateWithSessionSpec(page, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['volvox_all_vs_all'],
          views: Array.from({ length: rows }, (_, i) => ({
            loc: 'ctgA:20000-25000',
            assembly: ['volvox_ins', 'volvox', 'volvox_del'][i],
          })),
        },
      ],
    })
    await page.waitForSelector('[data-testid="follow-synteny-toggle"]', {
      timeout: 120000,
    })
    await delay(6000)
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 900 })
      await delay(1000)
      const r = await read(page)
      if (!r) {
        console.log(`rows ${rows} window ${width}: header not found`)
        continue
      }
      const over = r.bar.scroll - r.bar.client
      console.log(
        `\nrows ${rows}  window ${width}  bar client ${r.bar.client} scroll ${r.bar.scroll}` +
          `${over > 0 ? `  OVERFLOW +${over}` : ''}  searchBoxes ${r.searchBoxes.join(',')}`,
      )
      console.log(
        r.children.map(c => `  ${c.label.padEnd(26)} ${c.w}`).join('\n'),
      )
    }
    await page.close()
  }
} finally {
  await browser.close()
  server?.close()
}
