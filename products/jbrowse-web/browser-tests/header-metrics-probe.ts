/* eslint-disable no-console */
// One-off probe: report the geometry of every control in the LinearSyntenyView
// header bar, so misaligned/mismatched buttons can be measured rather than
// eyeballed.
import { BASE_CHROME_ARGS, displayPainted } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
  waitForDisplayPaint,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
})

try {
  const page = await browser.newPage()
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'Pp01:28,000,000..29,000,000', assembly: 'peach' },
            { loc: 'chr1:300,000..400,000', assembly: 'grape' },
          ],
        },
      ],
    },
    'test_data/grape_peach_synteny/config.json',
  )
  await waitForDisplayPaint(page, displayPainted('synteny_canvas'), 90000)
  await waitForDataLoaded(page, 90000)

  const out = await page.evaluate(() => {
    const bar = document
      .querySelector('[data-testid="follow-synteny-toggle"]')
      ?.closest('div') as HTMLElement | null
    return {
      bar: bar
        ? (({ x, y, width, height }) => ({ x, y, width, height }))(
            bar.getBoundingClientRect(),
          )
        : null,
      children: [...(bar?.children ?? [])].map(c => ({
        tag: c.tagName,
        cls: c.className.toString().slice(0, 60),
        label: c.getAttribute('aria-label') ?? c.getAttribute('title') ?? '',
        testid: (c as HTMLElement).dataset.testid ?? '',
        rect: (({ x, y, width, height }) => ({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        }))(c.getBoundingClientRect()),
      })),
    }
  })
  console.log(JSON.stringify(out, null, 2))
} finally {
  await browser.close()
  server.close()
}
