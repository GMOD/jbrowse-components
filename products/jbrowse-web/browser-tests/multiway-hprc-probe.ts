/* eslint-disable no-console */
// One-off probe: the CFH-cluster multi-way track over the HPRC test config —
// hg38 anchored, one lane per haplotype with its own CAT gene models, and the
// CFHR3/CFHR1 ribbon chains stopping at the deletion carrier's lane.
//
//   node products/jbrowse-web/browser-tests/multiway-hprc-probe.ts [out.png]
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, navigateWithSessionSpec, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outPath = (process.argv[2] ??
  'multiway-hprc-probe.png') as `${string}.png`

const { server, port } = await startServerOnFreePort(3400)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900 },
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
          assembly: 'hg38',
          loc: 'chr1:196,480,000-196,980,000',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              displayMode: 'compact',
            },
            {
              trackId: 'hprc_cfhr_multiway',
              type: 'MultiWaySyntenyDisplay',
              rowOrder: ['HG00099.1', 'HG01109.1'],
              height: 220,
            },
          ],
        },
      ],
    },
    'test_data/graphgenomeview/hprc.json',
  )
  await delay(20000)
  const state = await page.evaluate(() => {
    const display = document.querySelector(
      '[data-testid="multiway-synteny-display"]',
    )
    return {
      geneGlyphs: display?.querySelectorAll('g').length,
      ribbons: display?.querySelectorAll('path').length,
      lanesCurrent: display?.querySelector('svg')?.dataset.lanesCurrent,
      labels: [...(display?.querySelectorAll('text') ?? [])].map(
        t => t.textContent,
      ),
    }
  })
  console.log(JSON.stringify(state, null, 2))
  const view = await page.$('[data-testid^="view-container-"]')
  await view!.screenshot({ path: outPath })
  console.log(`screenshot: ${outPath}`)
} finally {
  await browser.close()
  server.close()
}
