import {
  PORT,
  delay,
  findByTestId,
  findByText,
  waitForDataLoaded,
} from '../helpers.ts'
import { capturePageSnapshot, dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// STAT4 locus on hg19; the lead SNP rs4274624 (-log10 p ≈ 65) sits at ~51%
// across this window and is the only point reaching the top of the plot.
const STAT4 = { start: 191790000, end: 192120000, lead: 191958656 }

async function gotoStat4(page: Page) {
  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg19',
        loc: `2:${STAT4.start}-${STAT4.end}`,
        tracks: ['sle_gwas_ld'],
      },
    ],
  }
  const specParam = encodeURIComponent(JSON.stringify(spec))
  await page.goto(
    `http://localhost:${PORT}/?config=test_data/config_gwas.json&session=spec-${specParam}&sessionName=GWAS%20LocusZoom`,
    { waitUntil: 'networkidle0', timeout: 60000 },
  )
  await findByTestId(page, 'manhattan-gpu-done', 60000)
  await waitForDataLoaded(page)
}

// LocusZoom-style GWAS demo: SLE summary stats from the locuszoomr dataset
// colored by LD r² to the auto-picked index SNP. Uses real hg19 loci, so the
// assembly sequence is fetched remotely — hence requiresRemote.
const suite: TestSuite = {
  name: 'GWAS LocusZoom LD',
  requiresRemote: true,
  tests: [
    {
      name: 'STAT4 locus Manhattan plot renders with LD coloring',
      requiresRemote: true,
      fn: async page => {
        await gotoStat4(page)
        await dualSnapshot(
          page,
          'gwas-locuszoom-stat4-canvas',
          '[data-testid="manhattan-gpu-done"] canvas',
        )
      },
    },
    {
      name: 'Right-click a SNP re-anchors LD coloring to it',
      requiresRemote: true,
      fn: async page => {
        await gotoStat4(page)

        // right-click the lead SNP at its x-fraction across the window. The
        // lead (-log10 p ≈ 65) sits at the top of the plot, but the exact y
        // depends on the niced domain, so scan a few offsets until the
        // point-hit context menu (rather than the native one) appears.
        const canvas = await page.waitForSelector(
          '[data-testid="manhattan-gpu-done"] canvas',
          { timeout: 60000 },
        )
        const box = (await canvas!.boundingBox())!
        const frac = (STAT4.lead - STAT4.start) / (STAT4.end - STAT4.start)
        const x = box.x + frac * box.width
        let menuItem = null
        for (const dy of [6, 12, 20, 30, 45, 60]) {
          await page.mouse.click(x, box.y + dy, { button: 'right' })
          menuItem = await findByText(page, /Color by LD to 2:/, 2500).catch(
            () => null,
          )
          if (menuItem) {
            break
          }
        }
        if (!menuItem) {
          throw new Error('context menu did not open over a SNP')
        }

        await capturePageSnapshot(page, 'gwas-locuszoom-context-menu')

        // menuItem is narrowed non-null by the guard above; the menu is still
        // open so reuse the handle from the scan
        await menuItem.click()

        // recolor refetch completes; snapshot the re-anchored canvas
        await delay(1000)
        await findByTestId(page, 'manhattan-gpu-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'gwas-locuszoom-reanchored-canvas',
          '[data-testid="manhattan-gpu-done"] canvas',
        )
      },
    },
  ],
}

export default suite
