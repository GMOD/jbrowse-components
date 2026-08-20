/* eslint-disable no-console */
// One-off probe: photograph the LinearSyntenyView header bar and each menu it
// opens, so the icon run and the menu depth can be looked at.
//
//   node products/jbrowse-web/browser-tests/header-probe.ts [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS, displayPainted } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outDir = process.argv[2] ?? '/tmp/header-probe'
const rows = Number(process.argv[3] ?? 2)

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
})

const ALL_ROWS = [
  { loc: 'Pp01:28,000,000..29,000,000', assembly: 'peach' },
  { loc: 'chr1:300,000..400,000', assembly: 'grape' },
  { loc: 'Pp01:28,000,000..29,000,000', assembly: 'peach' },
]

try {
  const page = await browser.newPage()
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: ALL_ROWS.slice(0, rows),
        },
      ],
    },
    'test_data/grape_peach_synteny/config.json',
  )
  await waitForDisplayPaint(page, displayPainted('synteny_canvas'), 90000)
  await waitForDataLoaded(page, 90000)

  const shoot = async (
    name: string,
    clip?: { x: number; y: number; width: number; height: number },
  ) => {
    const p = path.join(outDir, `${name}.png`)
    await page.screenshot({ path: p, ...(clip ? { clip } : {}) })
    console.log(`wrote ${p}`)
  }

  await shoot('full')
  await shoot('headerbar', { x: 0, y: 0, width: 1400, height: 200 })

  const headerButtons = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map(b => ({
        label: b.getAttribute('aria-label') ?? b.getAttribute('title') ?? '',
        testid: b.dataset.testid ?? '',
        rect: (({ x, y, width, height }) => ({ x, y, width, height }))(
          b.getBoundingClientRect(),
        ),
      }))
      .filter(b => b.rect.y > 80 && b.rect.y < 130 && b.rect.width > 0),
  )

  for (const [i, b] of headerButtons.entries()) {
    await page.mouse.click(
      b.rect.x + b.rect.width / 2,
      b.rect.y + b.rect.height / 2,
    )
    await new Promise(r => setTimeout(r, 800))
    const name = `menu-${i}-${(b.label || b.testid || 'x').slice(0, 30).replace(/\W+/g, '_')}`
    await shoot(name)
    const text = await page.evaluate(() =>
      [...document.querySelectorAll('[role="menu"], .MuiPopover-paper')]
        .map(el => (el as HTMLElement).innerText)
        .join('\n--- popover ---\n'),
    )
    console.log(`### ${i} ${b.label || b.testid}\n${text}\n`)
    // click far away rather than Escape: a cascading menu eats the key
    await page.mouse.click(1390, 880)
    await new Promise(r => setTimeout(r, 500))
  }
} finally {
  await browser.close()
  server.close()
}
