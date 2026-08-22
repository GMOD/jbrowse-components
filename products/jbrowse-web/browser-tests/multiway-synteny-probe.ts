/* eslint-disable no-console */
// One-off probe (not a suite): does MultiWaySyntenyDisplay draw its lanes and
// ribbons in a real bundle? The jest test proves the fetch and grouping; this
// is the check on the SVG body — a real LGV, a real MCScanBlocksAdapter track,
// glyph rects and ribbon paths on screen.
//
//   node products/jbrowse-web/browser-tests/multiway-synteny-probe.ts [out.png]
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDisplayDrawn,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outPath = process.argv[2] ?? 'multiway-synteny-probe.png'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
})

try {
  const page = await browser.newPage()
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e instanceof Error ? e.message : String(e)}`)
  })
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'grape',
          loc: 'chr1:1-1000',
          tracks: ['multiway_blocks'],
        },
      ],
    },
    'test_data/multiway_blocks/config.json',
  )
  try {
    await waitForDisplayDrawn(
      page,
      'multiway_blocks-MultiWaySyntenyDisplay',
      30000,
    )
  } catch (e) {
    const state = await page.evaluate(() => {
      const displays = [
        ...document.querySelectorAll<HTMLElement>('[data-display-id]'),
      ].map(el => ({
        id: el.dataset.displayId,
        phase: el.dataset.displayPhase,
        drawn: el.dataset.displayDrawn,
        testid: el.dataset.testid,
      }))
      const errors = [
        ...document.querySelectorAll('[data-testid="display-error"]'),
      ].map(el => el.textContent)
      return {
        displays,
        errors,
        body: document.body.textContent.slice(0, 500),
      }
    })
    console.log('TIMEOUT STATE:', JSON.stringify(state, null, 2))
    await page.screenshot({
      path: outPath.replace('.png', '-debug.png'),
    })
    throw e
  }

  const counts = await page.evaluate(() => {
    const display = document.querySelector(
      '[data-testid="multiway-synteny-display"]',
    )
    return {
      rects: display?.querySelectorAll('rect').length ?? -1,
      paths: display?.querySelectorAll('path').length ?? -1,
      labels: [...(display?.querySelectorAll('text') ?? [])].map(
        t => t.textContent,
      ),
    }
  })
  console.log(JSON.stringify(counts))

  const view = await page.$('[data-testid^="view-container-"]')
  await view!.screenshot({ path: outPath })
  console.log(`screenshot: ${outPath}`)

  if (counts.rects > 0 && counts.paths > 0) {
    console.log('OK: glyphs and ribbons rendered')
  } else {
    console.log('FAIL: display drawn but empty')
    process.exitCode = 1
  }
} finally {
  await browser.close()
  server.close()
}
