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
  // pre-approve the graph plugin the hosted E. coli config declares, the same
  // move the screenshot generator's trustCapturePlugins makes
  await page.evaluateOnNewDocument(() => {
    try {
      const KEY = 'jbrowse-trusted-plugins'
      const raw = localStorage.getItem(KEY)
      const trusted = new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
      trusted.add(
        'https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js',
      )
      localStorage.setItem(KEY, JSON.stringify([...trusted]))
    } catch (e) {
      console.error(e)
    }
  })
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e instanceof Error ? e.message : String(e)}`)
  })
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'human',
          loc: '2:176,090,000-176,290,000',
          tracks: [
            {
              trackId: 'human_genes',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              displayMode: 'compact',
            },
            {
              trackId: 'vertebrates_orthogroups',
              type: 'MultiWaySyntenyDisplay',
              rowOrder: ['chicken', 'frog', 'gar', 'zebrafish'],
              height: 320,
            },
          ],
        },
      ],
    },
    encodeURIComponent(
      'https://jbrowse.org/demos/orthofinder_vertebrates/config.json',
    ),
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
