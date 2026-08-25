import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const { port, server } = await startServerOnFreePort(3563)
setPort(port)
const browser = await launch({
  headless: true,
  args: BASE_CHROME_ARGS,
  defaultViewport: { width: 1280, height: 800 },
})
const page = await browser.newPage()

async function probe(display: Record<string, unknown>) {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:907..15319',
        tracks: [{ trackId: 'gff3tabix_genes', ...display }],
      },
    ],
  })
  await waitForDataLoaded(page, 60000)
  await new Promise(r => setTimeout(r, 1500))
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="feature-display"]')
    const d = (window as any).JBrowseSession?.views?.[0]?.tracks?.[0]
      ?.displays?.[0]
    const labels = root
      ? [...root.querySelectorAll('div')]
          .filter(el => el.childElementCount === 0 && !!el.textContent.trim())
          .map(el => el.textContent.trim())
      : []
    return {
      height: d?.height,
      maxIsoforms: d?.fitStage?.maxIsoforms,
      total: labels.length,
      subfeature: labels.filter(t => t.startsWith('EDEN.')).length,
      gene: labels.filter(t => t === 'EDEN').length,
    }
  })
}

function row(name: string, r: Awaited<ReturnType<typeof probe>>) {
  console.log(
    name.padEnd(12),
    String(r.height).padStart(7),
    String(r.maxIsoforms).padStart(9),
    String(r.total).padStart(7),
    String(r.subfeature).padStart(7),
    String(r.gene).padStart(5),
  )
}

try {
  console.log(
    'mode'.padEnd(12),
    'height'.padStart(7),
    'isoforms'.padStart(9),
    'labels'.padStart(7),
    'EDEN.n'.padStart(7),
    'EDEN'.padStart(5),
  )
  row('grow', await probe({ heightMode: 'grow', subfeatureLabels: 'below' }))
  for (const height of [100, 150, 200, 300, 400, 500, 700]) {
    row(
      `fit ${height}`,
      await probe({ heightMode: 'fit', height, subfeatureLabels: 'below' }),
    )
  }
} finally {
  await browser.close()
  server.close()
}
