import {
  PORT,
  appendGpuParam,
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const TRACK_ID = 'volvox_pangenome_50_gfa_tabix'

async function openGraphGenomeView(page: Page) {
  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=test_data/volvox/config.json&sessionName=Test%20Session`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
  await (await findByText(page, 'Add'))?.click()
  await delay(300)
  await (await findByText(page, 'Graph genome view'))?.click()
  await delay(500)
}

async function loadRegionInImportForm(page: Page, region: string) {
  // Click the MUI Select trigger inside the track field wrapper
  const trackSelectTrigger = await page.waitForSelector(
    '[data-testid="gfa-track-field"] .MuiSelect-select',
    { timeout: 10000 },
  )
  await trackSelectTrigger?.click()
  await delay(400)
  // Options appear in a MUI Menu portal
  const option = await page.waitForSelector('[role="option"]', {
    timeout: 5000,
  })
  await option?.click()
  await delay(300)

  // Type the region into the location autocomplete input
  const locInput = await page.waitForSelector(
    '[data-testid="gfa-loc-field"] input',
    { timeout: 5000 },
  )
  await locInput?.click()
  await locInput?.type(region, { delay: 40 })
  await locInput?.press('Escape')
  await delay(300)

  // Click Open
  const openBtn = await findByTestId(page, 'gfa-open-btn', 5000)
  await openBtn?.click()
}

const suite: TestSuite = {
  name: 'Graph Genome View — GfaTabix',
  tests: [
    {
      name: 'MultiLGVSyntenyDisplay renders with GfaTabixAdapter',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: [
                {
                  trackId: TRACK_ID,
                  displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
                },
              ],
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'multi-lgv-gfa-tabix-canvas',
          '[data-testid="multi_synteny_canvas_done"]',
        )
      },
    },
    {
      name: 'GraphGenomeView small mode: GfaTabix subgraph renders',
      fn: async page => {
        await openGraphGenomeView(page)
        await findByText(page, 'Load a GFA graph', 10000)

        await loadRegionInImportForm(page, 'ctgA:1-50000')

        await page.waitForSelector('[data-testid="graph-genome-canvas"]', {
          timeout: 90000,
        })
        await delay(2000)

        await canvasSnapshot(
          page,
          'graph-genome-tabix-small-canvas',
          '[data-testid="graph-genome-canvas"]',
          0.2,
        )
      },
    },
    {
      name: 'GraphGenomeView large mode: synteny overview renders',
      fn: async page => {
        await openGraphGenomeView(page)
        await findByText(page, 'Load a GFA graph', 10000)

        // Region > 100 kbp triggers large mode (LargeModeSyntenyCanvas)
        await loadRegionInImportForm(page, 'ctgA:1-200000')

        await page.waitForSelector('[data-testid="graph-large-mode-canvas"]', {
          timeout: 60000,
        })
        await delay(1500)

        await canvasSnapshot(
          page,
          'graph-genome-tabix-large-canvas',
          '[data-testid="graph-large-mode-canvas"]',
          0.2,
        )
      },
    },
  ],
}

export default suite
